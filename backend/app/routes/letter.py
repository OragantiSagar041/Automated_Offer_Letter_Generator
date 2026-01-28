from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import database, schemas
from ..models import models
from ..services.ai_service import ai_engine

router = APIRouter(
    prefix="/letters",
    tags=["letters"]
)

@router.post("/generate", response_model=schemas.LetterResponse)
def generate_letter(request: schemas.LetterRequest, db: Session = Depends(database.get_db)):
    # 1. Fetch Employee Data
    employee = db.query(models.Employee).filter(models.Employee.id == request.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # 2. Fetch Payroll Data (Assuming latest payroll for simplicity)
    payroll = db.query(models.Payroll).filter(models.Payroll.emp_id == request.employee_id).first()
    
    # 3. Prepare Data for AI
    if payroll:
        # Format Currency
        def fmt(val): return f"INR {val:,.2f}"
        
        data_context = {
            "name": employee.name,
            "role": employee.designation,
            "department": employee.department,
            "joining_date": str(employee.joining_date),
            "ctc": fmt(payroll.net_salary),
            "basic": fmt(payroll.basic_salary),
            "hra": fmt(payroll.hra),
            "allowance": fmt(payroll.allowances),
            "deductions": fmt(payroll.deductions),
            "pf": fmt(payroll.basic_salary * 0.12) # Approximation for display
        }
    else:
        data_context = {
            "name": employee.name,
            "role": employee.designation,
            "department": employee.department,
            "joining_date": str(employee.joining_date),
            "ctc": "TBD"
        }
    
    # Add Current Date for the Letter Header
    from datetime import date
    data_context["current_date"] = date.today().strftime('%Y-%m-%d')

    # 4. Call AI Service
    generated_text = ai_engine.generate_letter(data_context, request.letter_type)
    
    # 5. Save History
    new_letter = models.GeneratedLetter(
        emp_id=employee.id,
        letter_type=request.letter_type,
        content=generated_text,
        file_path=None # We aren't saving PDF to disk on server yet
    )
    db.add(new_letter)
    db.commit()

    return {"content": generated_text, "file_path": None}
