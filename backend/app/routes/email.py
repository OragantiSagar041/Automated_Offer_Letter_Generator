from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from .. import database
from ..services.email_service import email_client
from bson import ObjectId

router = APIRouter(
    prefix="/email",
    tags=["email"]
)

from typing import Optional
import base64

class EmailRequest(BaseModel):
    employee_id: str
    letter_content: str
    pdf_base64: Optional[str] = None
    custom_message: Optional[str] = None
    company_name: Optional[str] = "Arah Infotech Pvt Ltd"
    subject: Optional[str] = None

@router.post("/send")
def send_offer_email(request: EmailRequest, db = Depends(database.get_db)):
    if not ObjectId.is_valid(request.employee_id):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")

    # 1. Fetch Employee
    employee = db.employees.find_one({"_id": ObjectId(request.employee_id)})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Decode PDF if present
    pdf_bytes: Optional[bytes] = None
    b64_str = request.pdf_base64
    if b64_str and isinstance(b64_str, str):
        # Remove data URI header if present
        if "base64," in b64_str:
            b64_str = b64_str.split("base64,")[1]
        pdf_bytes = base64.b64decode(b64_str)

    # 2. Send Email (Backend Process)
    result = email_client.send_offer_letter(
        recipient_email=employee.get("email"),
        candidate_name=employee.get("name"),
        letter_content=request.letter_content,
        pdf_content=pdf_bytes,
        email_body=request.custom_message,
        subject=request.subject, 
        company_name=request.company_name,
        employee_id=request.employee_id
    )
    
    # 3. Update Status and Expiration if Sent
    if result.get("status") == "success":
        from datetime import datetime, timedelta
        expires_at = datetime.utcnow() + timedelta(hours=24)
        db.employees.update_one(
            {"_id": ObjectId(request.employee_id)},
            {"$set": {
                "status": "Offer Sent",
                "sent_at": datetime.utcnow(),
                "expires_at": expires_at
            }}
        )
    
    return result
