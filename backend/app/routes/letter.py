from fastapi import APIRouter, Depends, HTTPException
from .. import database, schemas
from ..services.ai_service import ai_engine
from bson import ObjectId
from datetime import datetime, date

router = APIRouter(
    prefix="/letters",
    tags=["letters"]
)

@router.post("/generate", response_model=schemas.LetterResponse)
def generate_letter(request: schemas.LetterRequest, db = Depends(database.get_db)):
    if not ObjectId.is_valid(request.employee_id):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")

    # 1. Fetch Employee Data
    employee = db.employees.find_one({"_id": ObjectId(request.employee_id)})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # 2. Fetch Payroll Data (From Embedded Compensation)
    comp = employee.get("compensation", {})
    
    # 3. Prepare Data for AI
    def fmt(val): 
        if val is None: return "INR 0.00"
        return f"INR {val:,.2f}"
    
    data_context = {
        "name": employee.get("name"),
        "role": employee.get("designation"),
        "department": employee.get("department"),
        "joining_date": str(employee.get("joining_date")),
        "ctc": fmt(comp.get("ctc")),
        "basic": fmt(comp.get("basic_salary")),
        "hra": fmt(comp.get("hra")),
        "allowance": fmt(comp.get("allowances")),
        "deductions": fmt(comp.get("deductions")),
        "pf": fmt(comp.get("basic_salary", 0) * 0.12), 
        "company_name": request.company_name
    }
    
    # Add Current Date for the Letter Header
    data_context["current_date"] = date.today().strftime('%Y-%m-%d')

    # 4. Call AI Service
    generated_text = ai_engine.generate_letter(data_context, request.letter_type)
    
    # 5. Save History
    new_letter = {
        "employee_id": ObjectId(request.employee_id), # Link to employee
        "emp_id": employee.get("emp_id"), # Store human readable ID too
        "letter_type": request.letter_type,
        "content": generated_text,
        "file_path": None,
        "generated_on": datetime.utcnow()
    }
    db.generated_letters.insert_one(new_letter)

    return {"content": generated_text, "file_path": None}
