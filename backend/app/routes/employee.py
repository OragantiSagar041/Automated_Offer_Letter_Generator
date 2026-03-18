from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from typing import List
from app import database, schemas
from bson import ObjectId
from datetime import datetime, date, timezone
import pandas as pd
import io

router = APIRouter(
    prefix="/employees",
    tags=["employees"]
)

# Helper to fix ObjectId in response if not using Pydantic v2 alias generator fully or for manual dicts
def fix_id(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
    return doc

@router.post("/", response_model=schemas.Employee)
def create_employee(employee: schemas.EmployeeCreate, db = Depends(database.get_db)):
    # Check if email exists
    if db.employees.find_one({"email": employee.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    emp_data = employee.model_dump()
    ctc = emp_data.pop('ctc')
    basic = emp_data.pop('basic_salary')
    manual_pt = emp_data.pop('pt', None)  # Monthly PT from frontend
    manual_pf = emp_data.pop('pf', None)  # Monthly PF from frontend

    # Fix: Convert date objects to datetime for MongoDB
    if emp_data.get('joining_date') and isinstance(emp_data['joining_date'], date):
        d = emp_data['joining_date']
        if not isinstance(d, datetime):
            emp_data['joining_date'] = datetime(d.year, d.month, d.day)
            print(f"Converted joining_date: {emp_data['joining_date']} (type: {type(emp_data['joining_date'])})")
    
    # Auto-generate emp_id if missing
    if not emp_data.get('emp_id'):
        count = db.employees.count_documents({})
        emp_data['emp_id'] = f"EMP{count + 1:03d}" 

    # --- Payroll Calculation (Matching NAVYA.docx format) ---
    basic_calculated = ctc * 0.40
    hra_calculated = basic_calculated * 0.40
    conveyance = min(basic_calculated * 0.267, 1600 * 12)
    medical_allowance = min(basic_calculated * 0.208, 1250 * 12)
    special_allowance = ctc - (basic_calculated + hra_calculated + conveyance + medical_allowance)
    
    if special_allowance < 0:
        special_allowance = 0

    gross_monthly = (basic_calculated + hra_calculated + conveyance + medical_allowance + special_allowance) / 12
    gross_annual = basic_calculated + hra_calculated + conveyance + medical_allowance + special_allowance
    
    # PT: Use manual value if provided, otherwise auto-calculate
    if manual_pt is not None:
        pt_monthly = manual_pt
    else:
        if gross_monthly <= 15000:
            pt_monthly = 0
        elif gross_monthly <= 20000:
            pt_monthly = 150
        else:
            pt_monthly = 200
    pt_annual = pt_monthly * 12
    
    # PF: Use manual value if provided, otherwise auto-calculate (12% of basic)
    if manual_pf is not None:
        pf_monthly = manual_pf
        pf_annual = pf_monthly * 12
    else:
        pf_annual = basic_calculated * 0.12
        pf_monthly = pf_annual / 12
    
    net_annual = gross_annual - pt_annual - pf_annual

    # Construct Document
    new_employee_doc = {
        **emp_data,
        "status": "Pending",
        "created_at": datetime.now(timezone.utc),
        "compensation": {
            "ctc": ctc,
            "basic_salary": round(basic_calculated, 2),
            "hra": round(hra_calculated, 2),
            "conveyance": round(conveyance, 2),
            "medical_allowance": round(medical_allowance, 2),
            "special_allowance": round(special_allowance, 2),
            "allowances": round(special_allowance, 2),
            "gross_salary": round(gross_annual, 2),
            "pt": round(pt_annual, 2),
            "pf": round(pf_annual, 2),
            "deductions": round(pf_annual + pt_annual, 2),
            "net_salary": round(net_annual, 2)
        }
    }
    
    # Insert
    result = db.employees.insert_one(new_employee_doc)
    new_employee_doc["_id"] = result.inserted_id
    
    return fix_id(new_employee_doc)

@router.get("/", response_model=List[schemas.Employee])
def read_employees(skip: int = 0, limit: int = 300, db = Depends(database.get_db)):
    # 1. Bulk Update Expired Offers (Optimized)
    db.employees.update_many(
        {
            "status": "Offer Sent",
            "expires_at": {"$lt": datetime.utcnow()}
        },
        {
            "$set": {
                "status": "Rejected", 
                "rejection_reason": "Offer Expired (24h)"
            }
        }
    )

    # 2. Fetch Employees
    cursor = db.employees.find().skip(skip).limit(limit)
    employees = [fix_id(doc) for doc in cursor]
    return employees

@router.get("/template")
def download_template():
    """
    Download Excel Template for Bulk Import.
    """
    headers = [
        "Employee ID", "Full Name", "Email Address", "Joining Date", 
        "Designation", "Department", "Employment Type", "Location", 
        "Annual CTC (₹)", "Basic Salary (Monthly) (₹)", "PT (Monthly) (₹)", "PF (Monthly) (₹)"
    ]
    df = pd.DataFrame(columns=headers)
    stream = io.BytesIO()
    df.to_excel(stream, index=False, engine='openpyxl')
    stream.seek(0)
    
    return StreamingResponse(
        stream, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        headers={"Content-Disposition": "attachment; filename=Employee_Import_Template.xlsx"}
    )

@router.get("/{employee_id}", response_model=schemas.Employee)
def read_employee(employee_id: str, db = Depends(database.get_db)):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")
        
    employee = db.employees.find_one({"_id": ObjectId(employee_id)})
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Single employee expiration check
    if employee.get("status") == "Offer Sent" and employee.get("expires_at"):
        exp = employee["expires_at"]
        if isinstance(exp, str):
            try: exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            except: pass
        if isinstance(exp, datetime) and datetime.now(timezone.utc) > exp:
            db.employees.update_one(
                {"_id": employee["_id"]},
                {"$set": {"status": "Rejected", "rejection_reason": "Offer Expired (24h)"}}
            )
            employee["status"] = "Rejected"
            employee["rejection_reason"] = "Offer Expired (24h)"
    
    return fix_id(employee)

@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: str, db = Depends(database.get_db)):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")

    result = db.employees.delete_one({"_id": ObjectId(employee_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Cascade delete generated letters
    db.generated_letters.delete_many({"employee_id": ObjectId(employee_id)})
    return

class BulkDeleteRequest(schemas.BaseModel):
    ids: List[str]

@router.post("/bulk-delete", status_code=204)
def bulk_delete_employees(request: BulkDeleteRequest, db = Depends(database.get_db)):
    valid_ids = []
    for emp_id in request.ids:
        if ObjectId.is_valid(emp_id):
            valid_ids.append(ObjectId(emp_id))
            
    if not valid_ids:
        return
        
    db.employees.delete_many({"_id": {"$in": valid_ids}})
    db.generated_letters.delete_many({"employee_id": {"$in": valid_ids}})
    return

@router.put("/{employee_id}", response_model=schemas.Employee)
def update_employee(employee_id: str, employee_update: schemas.EmployeeCreate, db = Depends(database.get_db)):
    if not ObjectId.is_valid(employee_id):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")

    existing = db.employees.find_one({"_id": ObjectId(employee_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_data = employee_update.model_dump()
    new_ctc = update_data.pop('ctc', None)
    update_data.pop('basic_salary', None)
    manual_pt = update_data.pop('pt', None)
    manual_pf = update_data.pop('pf', None)

    # Fix: Convert date objects to datetime for MongoDB (BSON doesn't support date)
    if update_data.get('joining_date') and isinstance(update_data['joining_date'], date):
        d = update_data['joining_date']
        if not isinstance(d, datetime):
            update_data['joining_date'] = datetime(d.year, d.month, d.day)

    # Handle Compensation Update if CTC changed
    if new_ctc and new_ctc != existing.get("compensation", {}).get("ctc"):
        basic = new_ctc * 0.40
        hra = basic * 0.40
        conveyance = min(basic * 0.267, 1600 * 12)
        medical_allowance = min(basic * 0.208, 1250 * 12)
        special = float(new_ctc) - (basic + hra + conveyance + medical_allowance)
        if special < 0: special = 0.0
        
        gross_monthly = (basic + hra + conveyance + medical_allowance + special) / 12
        gross_annual = basic + hra + conveyance + medical_allowance + special
        
        # PT: Use manual value if provided
        if manual_pt is not None:
            pt_monthly = manual_pt
        else:
            if gross_monthly <= 15000:
                pt_monthly = 0
            elif gross_monthly <= 20000:
                pt_monthly = 150
            else:
                pt_monthly = 200
        pt_annual = pt_monthly * 12
        
        # PF: Use manual value if provided
        if manual_pf is not None:
            pf_annual = manual_pf * 12
        else:
            pf_annual = basic * 0.12
        
        net_annual = gross_annual - pt_annual - pf_annual
        
        update_data["compensation"] = {
            "ctc": new_ctc,
            "basic_salary": round(basic, 2),
            "hra": round(hra, 2),
            "conveyance": round(conveyance, 2),
            "medical_allowance": round(medical_allowance, 2),
            "special_allowance": round(special, 2),
            "allowances": round(special, 2),
            "gross_salary": round(gross_annual, 2),
            "pt": round(pt_annual, 2),
            "pf": round(pf_annual, 2),
            "deductions": round(pf_annual + pt_annual, 2),
            "net_salary": round(net_annual, 2)
        }
    
    # Perform Update
    db.employees.update_one(
        {"_id": ObjectId(employee_id)},
        {"$set": update_data}
    )
    
    updated_doc = db.employees.find_one({"_id": ObjectId(employee_id)})
    return fix_id(updated_doc)

@router.post("/upload")
async def upload_employees_bulk(file: UploadFile = File(...), db = Depends(database.get_db)):
    """
    Bulk Upload Employees to MongoDB.
    """
    try:
        content = await file.read()
        if file.filename.endswith('.xlsx'):
            df = pd.read_excel(io.BytesIO(content))
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Invalid file format")
        
        # Normalize Headers
        df.columns = [str(c).lower().strip().replace(' ', '_') for c in df.columns]
        
        def find_col(aliases):
            for alias in aliases:
                if alias in df.columns: return alias
            return None

        success_count = 0
        errors = []

        for index, row in df.iterrows():
            try:
                # 1. Email
                col_email = find_col(['email', 'email_id', 'email_address'])
                email = row.get(col_email)
                if pd.isna(email) or not email:
                    errors.append(f"Row {index+2}: Email missing")
                    continue
                
                if db.employees.find_one({"email": email}):
                    errors.append(f"Skipped {email}: Exists")
                    continue

                # 2. Basic Fields
                col_name = find_col(['name', 'full_name'])
                name = row.get(col_name, "Unknown")
                
                col_desg = find_col(['designation', 'role'])
                desg = row.get(col_desg, "TBD")
                
                col_dept = find_col(['department'])
                dept = row.get(col_dept, "General")

                # 3. Joining Date
                col_date = find_col(['joining_date', 'doj'])
                jd = row.get(col_date)
                try:
                    j_date = pd.to_datetime(jd).strftime("%Y-%m-%d") if not pd.isna(jd) else datetime.now().strftime("%Y-%m-%d")
                except Exception:
                    j_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

                # 4. ID
                col_id = find_col(['emp_id'])
                emp_id = row.get(col_id)
                if pd.isna(emp_id) or not emp_id:
                    count = db.employees.count_documents({})
                    emp_id = f"EMP{count + 1 + success_count:03d}" 

                # 5. CTC & Compensation
                col_ctc = find_col(['annual_ctc_(₹)', 'ctc', 'annual_ctc'])
                ctc_val = row.get(col_ctc, 0)
                ctc = float(ctc_val) if not pd.isna(ctc_val) else 0

                basic = ctc * 0.40
                hra = basic * 0.40
                conveyance = min(basic * 0.267, 1600 * 12)
                medical_allowance = min(basic * 0.208, 1250 * 12)
                special = ctc - (basic + hra + conveyance + medical_allowance)
                if special < 0: special = 0
                
                gross_monthly = (basic + hra + conveyance + medical_allowance + special) / 12
                gross_annual = basic + hra + conveyance + medical_allowance + special

                # 6. Check for custom PT and PF in Excel
                col_pt = find_col(['pt_(monthly)_(₹)', 'pt', 'monthly_pt', 'monthly pt'])
                manual_pt = float(row.get(col_pt)) if col_pt and not pd.isna(row.get(col_pt)) else None
                
                col_pf = find_col(['pf_(monthly)_(₹)', 'pf', 'monthly_pf', 'monthly pf'])
                manual_pf = float(row.get(col_pf)) if col_pf and not pd.isna(row.get(col_pf)) else None

                if manual_pt is not None:
                    pt_monthly = manual_pt
                else:
                    if gross_monthly <= 15000:
                        pt_monthly = 0
                    elif gross_monthly <= 20000:
                        pt_monthly = 150
                    else:
                        pt_monthly = 200
                pt_annual = pt_monthly * 12
                
                if manual_pf is not None:
                    pf_monthly = manual_pf
                    pf_annual = pf_monthly * 12
                else:
                    pf_annual = basic * 0.12
                    
                net_annual = gross_annual - pt_annual - pf_annual

                doc = {
                    "emp_id": str(emp_id),
                    "name": name,
                    "email": email,
                    "designation": desg,
                    "department": dept,
                    "joining_date": j_date,
                    "location": row.get('location', 'Remote'),
                    "employment_type": row.get('employment_type', 'Full Time'),
                    "status": "Pending",
                    "created_at": datetime.now(timezone.utc),
                    "compensation": {
                        "ctc": ctc,
                        "basic_salary": round(basic, 2),
                        "hra": round(hra, 2),
                        "conveyance": round(conveyance, 2),
                        "medical_allowance": round(medical_allowance, 2),
                        "special_allowance": round(special, 2),
                        "allowances": round(special, 2),
                        "gross_salary": round(gross_annual, 2),
                        "pt": round(pt_annual, 2),
                        "pf": round(pf_annual, 2),
                        "deductions": round(pf_annual + pt_annual, 2),
                        "net_salary": round(net_annual, 2)
                    }
                }
                
                db.employees.insert_one(doc)
                success_count += 1

            except Exception as e:
                errors.append(f"Row {index+2}: {str(e)}")
        
        return {"status": "success", "imported_count": success_count, "errors": errors}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
