from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
from .. import database
from bson import ObjectId
from datetime import datetime, date
import pandas as pd
import io
import math

router = APIRouter(
    prefix="/agreement-companies",
    tags=["agreement-companies"]
)

# ── Schemas ──
class CompensationAgreement(BaseModel):
    percentage: float

class CompanyBase(BaseModel):
    emp_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    joining_date: Optional[date] = None
    location: Optional[str] = "Remote"
    employment_type: Optional[str] = "Full Time"
    address: Optional[str] = ""
    replacement: Optional[str] = ""
    signature: Optional[str] = ""
    invoice_post_joining: Optional[str] = ""
    payment_release: Optional[str] = ""

class CompanyCreate(CompanyBase):
    percentage: float

class CompanyResponse(CompanyBase):
    id: Optional[str] = None
    status: Optional[str] = "Pending"
    compensation: Optional[CompensationAgreement] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

# ── Helpers ──
def fix_id(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        doc.pop("_id", None)
    return doc

def sanitize_doc(doc):
    if not doc:
        return doc
    
    email = doc.get("email")
    if email is not None and not isinstance(email, str):
        doc["email"] = f"{int(email)}@imported.local"
    elif not email:
        doc["email"] = "unknown@imported.local"
    
    for field in ["designation", "department", "name", "emp_id", "location", 
                   "employment_type", "address", "replacement", "signature", 
                   "invoice_post_joining", "payment_release"]:
        val = doc.get(field)
        if val is not None:
            if isinstance(val, float) and math.isnan(val):
                doc[field] = None
            elif not isinstance(val, str) and val is not None:
                doc[field] = str(val)
    
    comp = doc.get("compensation")
    if isinstance(comp, dict) and "percentage" not in comp:
        doc["compensation"] = {"percentage": 0.0}
    elif comp is None:
        doc["compensation"] = {"percentage": 0.0}
    
    return doc

# ── Routes ──
@router.post("/", response_model=CompanyResponse)
def create_company(company: CompanyCreate, db = Depends(database.get_db)):
    if db.companies.find_one({"email": company.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    comp_data = company.dict()
    percentage = comp_data.pop('percentage', 0.0)

    if comp_data.get('joining_date') and isinstance(comp_data['joining_date'], date):
        d = comp_data['joining_date']
        if not isinstance(d, datetime):
            comp_data['joining_date'] = datetime(d.year, d.month, d.day)
    
    if not comp_data.get('emp_id'):
        count = db.companies.count_documents({})
        comp_data['emp_id'] = f"EMP{count + 1:03d}" 

    new_doc = {
        **comp_data,
        "status": "Pending",
        "created_at": datetime.utcnow(),
        "compensation": {
            "percentage": percentage
        }
    }
    
    result = db.companies.insert_one(new_doc)
    new_doc["_id"] = result.inserted_id
    
    return fix_id(new_doc)

@router.get("/", response_model=List[CompanyResponse])
def read_companies(skip: int = 0, limit: int = 100, db = Depends(database.get_db)):
    cursor = db.companies.find().skip(skip).limit(limit)
    companies = [sanitize_doc(fix_id(doc)) for doc in cursor]
    return companies

@router.get("/template")
def download_template():
    headers = [
        "Company Name", "Email Contact", "Date of Agreement",
        "Compensation %", "Registered Office Address",
        "Replacement Period (Days)", "Invoice Post Joining (Days)",
        "Payment Release (Days)", "Signatory Name", "Designation"
    ]
    df = pd.DataFrame(columns=headers)
    stream = io.BytesIO()
    df.to_excel(stream, index=False, engine='openpyxl')
    stream.seek(0)
    
    return StreamingResponse(
        stream, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        headers={"Content-Disposition": "attachment; filename=Company_Import_Template.xlsx"}
    )

@router.get("/{company_id}", response_model=CompanyResponse)
def read_company(company_id: str, db = Depends(database.get_db)):
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")
        
    company = db.companies.find_one({"_id": ObjectId(company_id)})
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return fix_id(company)

@router.delete("/{company_id}", status_code=204)
def delete_company(company_id: str, db = Depends(database.get_db)):
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")

    result = db.companies.delete_one({"_id": ObjectId(company_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    db.generated_agreements.delete_many({"employee_id": ObjectId(company_id)})
    return

@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(company_id: str, company_update: CompanyCreate, db = Depends(database.get_db)):
    if not ObjectId.is_valid(company_id):
        raise HTTPException(status_code=400, detail=f"Invalid ObjectId: '{company_id}'")

    existing = db.companies.find_one({"_id": ObjectId(company_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Company not found")

    update_data = company_update.dict()
    new_percentage = update_data.pop('percentage', None)

    if update_data.get('joining_date') and isinstance(update_data['joining_date'], date):
        d = update_data['joining_date']
        if not isinstance(d, datetime):
            update_data['joining_date'] = datetime(d.year, d.month, d.day)

    if new_percentage is not None:
        update_data["compensation"] = {
            "percentage": new_percentage
        }
    
    db.companies.update_one(
        {"_id": ObjectId(company_id)},
        {"$set": update_data}
    )
    
    updated_doc = db.companies.find_one({"_id": ObjectId(company_id)})
    return fix_id(updated_doc)

@router.post("/upload")
async def upload_companies_bulk(file: UploadFile = File(...), db = Depends(database.get_db)):
    try:
        content = await file.read()
        if file.filename.endswith('.xlsx'):
            df = pd.read_excel(io.BytesIO(content))
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Invalid file format")
        
        df.columns = [str(c).lower().strip().replace(' ', '_') for c in df.columns]
        
        def find_col(aliases):
            for alias in aliases:
                if alias in df.columns: return alias
            return None

        success_count = 0
        errors = []

        for index, row in df.iterrows():
            try:
                col_email = find_col(['email', 'email_id', 'email_address', 'email_contact'])
                email = row.get(col_email) if col_email else None
                if pd.isna(email) or not email:
                    errors.append(f"Row {index+2}: Email missing")
                    continue
                
                if db.companies.find_one({"email": email}):
                    errors.append(f"Skipped {email}: Exists")
                    continue

                col_name = find_col(['name', 'full_name', 'company_name'])
                name = row.get(col_name, "Unknown")
                
                col_desg = find_col(['designation', 'role'])
                desg = row.get(col_desg, "TBD")
                
                col_date = find_col(['joining_date', 'agreement_date', 'doj', 'date_of_agreement'])
                jd = row.get(col_date) if col_date else None
                try:
                    j_date = pd.to_datetime(jd).strftime("%Y-%m-%d") if not pd.isna(jd) else datetime.now().strftime("%Y-%m-%d")
                except:
                    j_date = datetime.now().strftime("%Y-%m-%d")

                col_id = find_col(['emp_id', 'partner_id'])
                emp_id = row.get(col_id) if col_id else None
                if pd.isna(emp_id) or not emp_id:
                    count = db.companies.count_documents({})
                    emp_id = f"EMP{count + 1 + success_count:03d}" 

                col_pct = find_col(['percentage', 'revenue_share_percentage_(%)', 'compensation_%'])
                pct_val = row.get(col_pct, 0) if col_pct else 0
                pct = float(pct_val) if not pd.isna(pct_val) else 0

                doc = {
                    "emp_id": str(emp_id),
                    "name": name,
                    "email": email,
                    "designation": desg,
                    "joining_date": j_date,
                    "location": row.get('location', 'Remote'),
                    "address": row.get('registered_office_address', row.get('address', '')),
                    "replacement": str(row.get('replacement_period_(days)', row.get('replacement_(days)', row.get('replacement', '')))),
                    "invoice_post_joining": str(row.get('invoice_post_joining_(days)', row.get('invoice_post_joining', ''))),
                    "payment_release": str(row.get('payment_release_(days)', row.get('payment_release', ''))),
                    "signature": row.get('signatory_name', ''),
                    "status": "Pending",
                    "created_at": datetime.utcnow(),
                    "compensation": {
                        "percentage": pct
                    }
                }
                
                db.companies.insert_one(doc)
                success_count += 1

            except Exception as e:
                errors.append(f"Row {index+2}: {str(e)}")
        
        return {"status": "success", "imported_count": success_count, "errors": errors}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
