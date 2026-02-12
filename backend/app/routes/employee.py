from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import database, schemas
from ..models import models

router = APIRouter(
    prefix="/employees",
    tags=["employees"]
)

@router.post("/", response_model=schemas.Employee)
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(database.get_db)):
    # Check if email exists
    db_employee = db.query(models.Employee).filter(models.Employee.email == employee.email).first()
    if db_employee:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Extract Payroll info (ctc, basic) from request
    emp_data = employee.dict()
    ctc = emp_data.pop('ctc')
    basic = emp_data.pop('basic_salary')
    
    # Create Employee Record
    try:
        # Auto-generate emp_id if missing
        if not emp_data.get('emp_id'):
            # Find max PK to determine sequence
            max_id = db.query(models.Employee.id).order_by(models.Employee.id.desc()).first()
            next_seq = (max_id[0] + 1) if max_id else 1
            emp_data['emp_id'] = f"EMP{next_seq:03d}" # e.g. EMP001, EMP002
        
        new_employee = models.Employee(**emp_data)
        db.add(new_employee)
        db.commit()
        db.refresh(new_employee)
    except Exception as e:
        db.rollback()
        if "UNIQUE constraint failed: employees.emp_id" in str(e):
             raise HTTPException(status_code=400, detail="Employee ID already exists")
        raise e

    # --- Advanced Payroll Calculation (Indian Standard) ---
    # 1. Basic Salary = 50% of CTC
    basic_calculated = ctc * 0.5
    
    # 2. HRA = 50% of Basic (Metros)
    hra_calculated = basic_calculated * 0.5
    
    # 3. PF (Provident Fund) = 12% of Basic
    pf_calculated = basic_calculated * 0.12
    
    # 4. Professional Tax (Standard avg)
    pt_calculated = 200 * 12 # Annual
    
    # 5. Special Allowance = Balancing Figure
    # CTC = Basic + HRA + Special Allowance + PF (Employer share included in CTC)
    # Special = CTC - (Basic + HRA + PF)
    special_allowance = ctc - (basic_calculated + hra_calculated + pf_calculated)
    
    if special_allowance < 0:
        # Edge case for low CTC: Adjust Basic/HRA to fit
        special_allowance = 0
        basic_calculated = ctc / 1.62 # Approximately back-calculated
        hra_calculated = basic_calculated * 0.5
        pf_calculated = basic_calculated * 0.12

    new_payroll = models.Payroll(
        emp_id=new_employee.id,
        basic_salary=round(basic_calculated, 2),
        hra=round(hra_calculated, 2),
        allowances=round(special_allowance, 2),
        deductions=round(pf_calculated + pt_calculated, 2), # PF + PT
        net_salary=ctc, # Storing Total CTC here for reference
        month="Joining",
        year=2026
    )
    db.add(new_payroll)
    db.commit()

    # Populate fields for schema response
    new_employee.ctc = ctc
    new_employee.basic_salary = round(basic_calculated, 2)

    return new_employee

@router.get("/", response_model=List[schemas.Employee])
def read_employees(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    employees = db.query(models.Employee).offset(skip).limit(limit).all()
    
    # Populate payroll info
    for emp in employees:
        # Get latest payroll (safest bet: check relationship)
        # Note: This relys on lazy loading 'payrolls'
        payrolls = emp.payrolls
        if payrolls:
            # Sort by ID descending to get latest
            latest = sorted(payrolls, key=lambda x: x.id, reverse=True)[0]
            emp.ctc = latest.net_salary
            emp.basic_salary = latest.basic_salary
        else:
            emp.ctc = 0.0
            emp.basic_salary = 0.0
            
    return employees

@router.get("/template")
def download_template():
    """
    Download Excel Template for Bulk Import.
    """
    # Create DataFrame with headers only. Matching the fields in Add Employee Modal.
    headers = [
        "Employee ID", "Full Name", "Email Address", "Designation", 
        "Department", "Joining Date", "Location", "Employment Type", 
        "Annual CTC", "Basic Salary"
    ]
    df = pd.DataFrame(columns=headers)
    
    # Create Excel buffer
    stream = io.BytesIO()
    # Use openpyxl engine for xlsx
    df.to_excel(stream, index=False, engine='openpyxl')
    stream.seek(0)
    
    return StreamingResponse(
        stream, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
        headers={"Content-Disposition": "attachment; filename=Employee_Import_Template.xlsx"}
    )

@router.get("/{employee_id}", response_model=schemas.Employee)
def read_employee(employee_id: int, db: Session = Depends(database.get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Populate payroll info
    payrolls = employee.payrolls
    if payrolls:
        latest = sorted(payrolls, key=lambda x: x.id, reverse=True)[0]
        employee.ctc = latest.net_salary
        employee.basic_salary = latest.basic_salary
    else:
        employee.ctc = 0.0
        employee.basic_salary = 0.0
        
    return employee

@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: Session = Depends(database.get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Cascade delete payrolls/letters if not set in DB (SQLAlchemy usually handles if configured, but let's be safe)
    # Actually models.py relationship usually doesn't cascade unless specified.
    # We will manually delete dependent records to be clean.
    db.query(models.Payroll).filter(models.Payroll.emp_id == employee_id).delete()
    db.query(models.GeneratedLetter).filter(models.GeneratedLetter.emp_id == employee_id).delete()
    
    db.delete(employee)
    db.commit()
    return

@router.put("/{employee_id}", response_model=schemas.Employee)
def update_employee(employee_id: int, employee_update: schemas.EmployeeCreate, db: Session = Depends(database.get_db)):
    db_employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Update fields
    emp_data = employee_update.dict()
    # Remove payroll fields from this dict as they don't belong to Employee model
    new_ctc = emp_data.pop('ctc', None)
    emp_data.pop('basic_salary', None)

    for key, value in emp_data.items():
        setattr(db_employee, key, value)
    
    # If CTC changed, we should ideally re-calculate payroll.
    # For MVP Edit, we might skip payroll recalc or implement it. 
    # Let's Implement it for robustness.
    if new_ctc:
         db_payroll = db.query(models.Payroll).filter(models.Payroll.emp_id == employee_id).first()
         if db_payroll:
            # Re-run logic (Basic 50%, etc)
            basic = new_ctc * 0.5
            hra = basic * 0.5
            pf = basic * 0.12
            pt = 2400
            special = new_ctc - (basic + hra + pf)
            if special < 0: special = 0
            
            db_payroll.basic_salary = round(basic, 2)
            db_payroll.hra = round(hra, 2)
            db_payroll.allowances = round(special, 2)
            db_payroll.deductions = round(pf + pt, 2)
            db_payroll.net_salary = new_ctc
    
    db.commit()
    db.refresh(db_employee)
    db.commit()
    db.refresh(db_employee)
    
    # Re-fetch payroll for response
    # Or just populate what we know if we updated it
    payrolls = db_employee.payrolls
    if payrolls:
        latest = sorted(payrolls, key=lambda x: x.id, reverse=True)[0]
        db_employee.ctc = latest.net_salary
        db_employee.basic_salary = latest.basic_salary
    
    return db_employee

import pandas as pd
from fastapi import UploadFile, File
from fastapi.responses import StreamingResponse
import io
from datetime import datetime



@router.post("/upload")
async def upload_employees_bulk(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    """
    Bulk Upload Employees from Excel/CSV.
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
        print("DEBUG RAW COLS:", df.columns)
        df.columns = [str(c).lower().strip().replace(' ', '_') for c in df.columns]
        print("DEBUG NORM COLS:", df.columns)
        print("DEBUG HEAD:\n", df.head())
        
        # Helper to find column loosely
        def find_col(aliases):
            for alias in aliases:
                if alias in df.columns:
                    return alias
            return None

        success_count = 0
        errors = []

        for index, row in df.iterrows():
            try:
                # 1. Email (Required)
                col_email = find_col(['email', 'email_id', 'email_address'])
                email = row.get(col_email) if col_email else None
                
                if not email or pd.isna(email):
                    errors.append(f"Row {index+2}: Email missing")
                    continue

                if db.query(models.Employee).filter(models.Employee.email == email).first():
                    errors.append(f"Skipped {email}: Exists")
                    continue

                # 2. Name
                col_name = find_col(['name', 'full_name', 'employee_name', 'candidate_name'])
                name = row.get(col_name) if col_name else "Unknown"

                # 3. Designation
                col_desg = find_col(['designation', 'role', 'position', 'job_title'])
                desg = row.get(col_desg) if col_desg else "TBD"

                # 4. Department
                col_dept = find_col(['department', 'dept', 'domain', 'team'])
                dept = row.get(col_dept) if col_dept else "General"

                # 5. Joining Date
                col_date = find_col(['joining_date', 'date_of_joining', 'doj', 'start_date', 'joining'])
                jd = row.get(col_date) if col_date else None
                
                if pd.isna(jd):
                    j_date = datetime.now().date()
                else:
                    try:
                        j_date = pd.to_datetime(jd).date()
                    except:
                        j_date = datetime.now().date()

                # 6. ID
                col_id = find_col(['emp_id', 'employee_id', 'id'])
                emp_id = row.get(col_id) if col_id else None
                
                if not emp_id or pd.isna(emp_id):
                    max_id = db.query(models.Employee.id).order_by(models.Employee.id.desc()).first()
                    next_seq = (max_id[0] + 1) if max_id else 1
                    emp_id = f"EMP{next_seq:03d}"

                # 7. CTC
                col_ctc = find_col(['ctc', 'salary', 'annual_ctc', 'package'])
                ctc_val = row.get(col_ctc) if col_ctc else 0
                ctc = float(ctc_val) if not pd.isna(ctc_val) else 0

                new_emp = models.Employee(
                    emp_id=str(emp_id),
                    name=name,
                    email=email,
                    designation=desg,
                    department=dept,
                    joining_date=j_date,
                    location=row.get('location', 'Remote')
                )
                
                db.add(new_emp)
                db.flush()

                # Payroll Logic
                basic = ctc * 0.5
                hra = basic * 0.5
                pf = basic * 0.12
                pt = 2400
                special = ctc - (basic + hra + pf)
                if special < 0: special = 0
                
                new_payroll = models.Payroll(
                    emp_id=new_emp.id,
                    basic_salary=round(basic, 2),
                    hra=round(hra, 2),
                    allowances=round(special, 2),
                    deductions=round(pf + pt, 2),
                    net_salary=ctc,
                    month="Joining",
                    year=2026
                )
                db.add(new_payroll)
                db.commit() # Commit this row
                success_count += 1

            except Exception as e:
                db.rollback() 
                errors.append(f"Row {index+2}: {str(e)}")
        
        return {"status": "success", "imported_count": success_count, "errors": errors}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
