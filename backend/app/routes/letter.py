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
    def num(val): 
        """Return raw integer numeric value"""
        if val is None: return 0
        try: return int(round(float(val)))
        except: return 0
    
    # Format joining date nicely
    joining_raw = employee.get("joining_date")
    if joining_raw:
        try:
            if hasattr(joining_raw, 'strftime'):
                joining_formatted = joining_raw.strftime('%d/%m/%Y')
            else:
                from dateutil import parser
                joining_formatted = parser.parse(str(joining_raw)).strftime('%d/%m/%Y')
        except:
            joining_formatted = str(joining_raw).split(' ')[0]  # fallback: remove time
    else:
        joining_formatted = ''
    
    basic_val = num(comp.get("basic_salary", 0))
    hra_val = num(comp.get("hra", 0))
    conv_val = num(comp.get("conveyance", 0))
    med_val = num(comp.get("medical_allowance", 0))
    spec_val = num(comp.get("special_allowance", 0))
    gross_val = num(comp.get("gross_salary", 0))
    pt_val = num(comp.get("pt", 0))
    pf_val = num(comp.get("pf", 0))
    net_val = num(comp.get("net_salary", 0))
    ctc_val = num(comp.get("ctc", 0))
    
    # Fallback: compute gross if missing
    if gross_val == 0 and ctc_val > 0:
        gross_val = basic_val + hra_val + conv_val + med_val + spec_val
        if gross_val == 0:
            gross_val = ctc_val  # If no breakdown, gross = CTC
    
    # Fallback: compute net if missing  
    if net_val == 0 and gross_val > 0:
        net_val = gross_val - pt_val - pf_val
    
    data_context = {
        "name": employee.get("name"),
        "role": employee.get("designation"),
        "department": employee.get("department"),
        "joining_date": joining_formatted,
        "ctc": ctc_val,
        "basic": basic_val,
        "hra": hra_val,
        "conveyance": conv_val,
        "medical_allowance": med_val,
        "special_allowance": spec_val,
        "allowance": spec_val,
        "gross_salary": gross_val,
        "pt": pt_val,
        "pf": pf_val,
        "deductions": round(pt_val + pf_val, 2),
        "net_salary": net_val,
        "basic_monthly": basic_val // 12,
        "hra_monthly": hra_val // 12,
        "conveyance_monthly": conv_val // 12,
        "medical_monthly": med_val // 12,
        "special_monthly": spec_val // 12,
        "gross_monthly": gross_val // 12,
        "pt_monthly": pt_val // 12,
        "pf_monthly": pf_val // 12,
        "net_monthly": net_val // 12,
        "company_name": request.company_name
    }
    
    # Add Current Date for the Letter Header
    data_context["current_date"] = date.today().strftime('%d-%m-%Y')

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
