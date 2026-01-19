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

    return new_employee

@router.get("/", response_model=List[schemas.Employee])
def read_employees(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    employees = db.query(models.Employee).offset(skip).limit(limit).all()
    return employees

@router.get("/{employee_id}", response_model=schemas.Employee)
def read_employee(employee_id: int, db: Session = Depends(database.get_db)):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
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
    return db_employee
