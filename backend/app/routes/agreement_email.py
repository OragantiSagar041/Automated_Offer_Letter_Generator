from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from .. import database
from ..services.agreement_email_service import agreement_email_client
from bson import ObjectId

router = APIRouter(
    prefix="/agreement-email",
    tags=["agreement-email"]
)

from typing import Optional
import base64

class AgreementEmailRequest(BaseModel):
    employee_id: str
    letter_content: str
    pdf_base64: Optional[str] = None
    custom_message: Optional[str] = None
    company_name: Optional[str] = "Arah Infotech Pvt Ltd"
    subject: Optional[str] = None

@router.post("/send")
def send_agreement_email(request: AgreementEmailRequest, db = Depends(database.get_db)):
    if not ObjectId.is_valid(request.employee_id):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")

    # Fetch from companies collection
    company = db.companies.find_one({"_id": ObjectId(request.employee_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Decode PDF if present
    pdf_bytes = None
    if request.pdf_base64:
        if "base64," in request.pdf_base64:
            request.pdf_base64 = request.pdf_base64.split("base64,")[1]
        pdf_bytes = base64.b64decode(request.pdf_base64)

    result = agreement_email_client.send_agreement(
        recipient_email=company.get("email"),
        candidate_name=company.get("name"),
        letter_content=request.letter_content,
        pdf_content=pdf_bytes,
        email_body=request.custom_message,
        subject=request.subject, 
        company_name=request.company_name
    )
    
    # Update Status to "Agreement Sent"
    if result.get("status") == "success":
        db.companies.update_one(
            {"_id": ObjectId(request.employee_id)},
            {"$set": {"status": "Agreement Sent"}}
        )
    
    return result
