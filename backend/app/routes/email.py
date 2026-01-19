from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .. import database
from ..models import models
from ..services.email_service import email_client

router = APIRouter(
    prefix="/email",
    tags=["email"]
)

from typing import Optional
import base64

class EmailRequest(BaseModel):
    employee_id: int
    letter_content: str
    pdf_base64: Optional[str] = None
    custom_message: Optional[str] = None

@router.post("/send")
def send_offer_email(request: EmailRequest, db: Session = Depends(database.get_db)):
    # 1. Fetch Employee
    employee = db.query(models.Employee).filter(models.Employee.id == request.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Decode PDF if present
    pdf_bytes = None
    if request.pdf_base64:
        # Remove data URI header if present
        if "base64," in request.pdf_base64:
            request.pdf_base64 = request.pdf_base64.split("base64,")[1]
        pdf_bytes = base64.b64decode(request.pdf_base64)

    # 2. Send Email (Backend Process)
    result = email_client.send_offer_letter(
        recipient_email=employee.email,
        candidate_name=employee.name,
        letter_content=request.letter_content,
        pdf_content=pdf_bytes,
        email_body=request.custom_message,
        subject=getattr(request, 'subject', None) # Safely get subject
    )
    
    # 3. Update Status if Sent
    if result.get("status") == "success":
        employee.status = "Offer Sent"
        db.commit()
    
    return result
