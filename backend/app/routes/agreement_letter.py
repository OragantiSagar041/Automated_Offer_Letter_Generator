from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import Response
from .. import database
from ..services.agreement_ai_service import agreement_ai_engine
from bson import ObjectId
from datetime import datetime, date
from pydantic import BaseModel
from typing import Optional
import io

router = APIRouter(
    prefix="/agreement-letters",
    tags=["agreement-letters"]
)

class AgreementLetterRequest(BaseModel):
    employee_id: str 
    letter_type: str = "Agreement"
    tone: Optional[str] = "Professional"
    company_name: Optional[str] = "Arah Infotech Pvt Ltd"

class AgreementLetterResponse(BaseModel):
    content: str
    file_path: Optional[str] = None

@router.post("/generate", response_model=AgreementLetterResponse)
def generate_agreement_letter(request: AgreementLetterRequest, db = Depends(database.get_db)):
    if not ObjectId.is_valid(request.employee_id):
        raise HTTPException(status_code=400, detail="Invalid ObjectId")

    # Fetch from companies collection
    company = db.companies.find_one({"_id": ObjectId(request.employee_id)})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    comp = company.get("compensation", {})
    
    data_context = {
        "name": company.get("name"),
        "company_name": request.company_name,
        "percentage": comp.get("percentage", 0.0),
        "address": company.get("address", ""),
        "joining_date": company.get("joining_date", date.today().strftime('%Y-%m-%d')),
        "replacement": company.get("replacement", 60),
        "invoice_post_joining": company.get("invoice_post_joining", 45),
        "payment_release": company.get("payment_release", 15),
        "signature": company.get("signature", "Authorized Signatory")
    }
    
    data_context["current_date"] = date.today().strftime('%Y-%m-%d')

    generated_text = agreement_ai_engine.generate_letter(data_context, request.letter_type)
    
    new_letter = {
        "employee_id": ObjectId(request.employee_id),
        "emp_id": company.get("emp_id"),
        "letter_type": request.letter_type,
        "content": generated_text,
        "file_path": None,
        "generated_on": datetime.utcnow()
    }
    db.generated_agreements.insert_one(new_letter)

    return {"content": generated_text, "file_path": None}

@router.post("/download-docx")
def download_agreement_docx(html_content: str = Body(..., embed=True)):
    try:
        from htmldocx import HtmlToDocx
        from docx import Document
    except ImportError:
        raise HTTPException(status_code=500, detail="DOCX conversion libraries not installed")
    
    document = Document()
    new_parser = HtmlToDocx()
    new_parser.add_html_to_document(html_content, document)
    
    doc_io = io.BytesIO()
    document.save(doc_io)
    doc_io.seek(0)
    
    return Response(
        content=doc_io.read(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=Agreement.docx"}
    )
