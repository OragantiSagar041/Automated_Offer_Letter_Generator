"""
Offer Response Routes
Handles accept/reject actions from candidates via unique token links in emails.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from .. import database
from bson import ObjectId
from datetime import datetime

router = APIRouter(
    prefix="/offer",
    tags=["offer-response"]
)


def _build_response_page(status: str, candidate_name: str, company_name: str):
    """Build a beautiful HTML response page shown to the candidate after they click accept/reject."""
    
    if status == "accepted":
        icon = "🎉"
        title = "Offer Accepted!"
        message = f"Thank you, <strong>{candidate_name}</strong>! Your acceptance has been recorded."
        subtitle = f"Welcome to <strong>{company_name}</strong>. Our HR team will be in touch shortly with the next steps."
        gradient = "linear-gradient(135deg, #10b981 0%, #059669 100%)"
        accent = "#10b981"
        bg_accent = "rgba(16, 185, 129, 0.1)"
    else:
        icon = "📩"
        title = "Offer Declined"
        message = f"Thank you, <strong>{candidate_name}</strong>. Your response has been recorded."
        subtitle = f"We appreciate your time and wish you all the best in your future endeavors."
        gradient = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
        accent = "#f59e0b"
        bg_accent = "rgba(245, 158, 11, 0.1)"

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title} - {company_name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Inter', -apple-system, system-ui, sans-serif;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #0f172a;
                color: #f8fafc;
                overflow: hidden;
            }}
            .bg-grid {{
                position: fixed;
                inset: 0;
                background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0);
                background-size: 40px 40px;
                pointer-events: none;
            }}
            .bg-glow {{
                position: fixed;
                width: 600px;
                height: 600px;
                border-radius: 50%;
                background: {accent};
                opacity: 0.06;
                filter: blur(120px);
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
            }}
            .card {{
                position: relative;
                z-index: 1;
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 32px;
                padding: 4rem 3rem;
                max-width: 560px;
                width: 90%;
                text-align: center;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                animation: fadeInUp 0.6s ease-out;
            }}
            @keyframes fadeInUp {{
                from {{ opacity: 0; transform: translateY(30px); }}
                to {{ opacity: 1; transform: translateY(0); }}
            }}
            .icon {{
                font-size: 4rem;
                margin-bottom: 1.5rem;
                display: block;
                animation: bounce 1s ease-in-out;
            }}
            @keyframes bounce {{
                0%, 100% {{ transform: translateY(0); }}
                50% {{ transform: translateY(-15px); }}
            }}
            .badge {{
                display: inline-block;
                background: {gradient};
                color: white;
                padding: 8px 20px;
                border-radius: 50px;
                font-size: 0.8rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1.5px;
                margin-bottom: 1.5rem;
            }}
            h1 {{
                font-size: 2.2rem;
                font-weight: 800;
                margin-bottom: 1rem;
                letter-spacing: -0.5px;
            }}
            .message {{
                font-size: 1.05rem;
                color: #94a3b8;
                line-height: 1.7;
                margin-bottom: 0.75rem;
            }}
            .subtitle {{
                font-size: 0.95rem;
                color: #64748b;
                line-height: 1.6;
                margin-top: 1rem;
                padding: 1rem;
                background: {bg_accent};
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.05);
            }}
            .company {{
                margin-top: 2.5rem;
                padding-top: 1.5rem;
                border-top: 1px solid rgba(255,255,255,0.06);
                color: #475569;
                font-size: 0.85rem;
                font-weight: 600;
            }}
        </style>
    </head>
    <body>
        <div class="bg-grid"></div>
        <div class="bg-glow"></div>
        <div class="card">
            <span class="icon">{icon}</span>
            <div class="badge">{"Accepted" if status == "accepted" else "Declined"}</div>
            <h1>{title}</h1>
            <p class="message">{message}</p>
            <div class="subtitle">{subtitle}</div>
            <div class="company">© {datetime.now().year} {company_name}. All rights reserved.</div>
        </div>
    </body>
    </html>
    """


def _build_already_responded_page(current_status: str, candidate_name: str, company_name: str):
    """Page shown when the candidate has already responded."""
    status_text = "accepted" if current_status == "Accepted" else "declined"
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Already Responded - {company_name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Inter', -apple-system, system-ui, sans-serif;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #0f172a;
                color: #f8fafc;
            }}
            .card {{
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 32px;
                padding: 4rem 3rem;
                max-width: 500px;
                width: 90%;
                text-align: center;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }}
            .icon {{ font-size: 3rem; margin-bottom: 1rem; }}
            h1 {{ font-size: 1.8rem; font-weight: 800; margin-bottom: 1rem; }}
            p {{ color: #94a3b8; line-height: 1.6; }}
        </style>
    </head>
    <body>
        <div class="card">
            <span class="icon">ℹ️</span>
            <h1>Already Responded</h1>
            <p>Hi <strong>{candidate_name}</strong>, you have already <strong>{status_text}</strong> this offer.</p>
            <p style="margin-top: 1rem; color: #64748b;">If you believe this is an error, please contact the HR team.</p>
        </div>
    </body>
    </html>
    """


def _build_invalid_page():
    """Page shown for invalid or expired tokens."""
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invalid Link</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Inter', -apple-system, system-ui, sans-serif;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #0f172a;
                color: #f8fafc;
            }
            .card {
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 32px;
                padding: 4rem 3rem;
                max-width: 500px;
                width: 90%;
                text-align: center;
            }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 1rem; color: #ef4444; }
            p { color: #94a3b8; line-height: 1.6; }
        </style>
    </head>
    <body>
        <div class="card">
            <span class="icon">⚠️</span>
            <h1>Invalid or Expired Link</h1>
            <p>This link is no longer valid. Please contact the HR team if you need assistance.</p>
        </div>
    </body>
    </html>
    """


@router.get("/accept")
def accept_offer(token: str, db = Depends(database.get_db)):
    """Handle offer acceptance from email link."""
    
    # Look up the token in offer_tokens collection
    token_doc = db.offer_tokens.find_one({"token": token})
    
    if not token_doc:
        return HTMLResponse(content=_build_invalid_page(), status_code=404)
    
    employee_id = token_doc["employee_id"]
    company_name = token_doc.get("company_name", "The Company")
    
    # Get employee
    employee = db.employees.find_one({"_id": ObjectId(employee_id)})
    if not employee:
        return HTMLResponse(content=_build_invalid_page(), status_code=404)
    
    candidate_name = employee.get("name", "Candidate")
    current_status = employee.get("status", "")
    
    # Check if already responded
    if current_status in ("Accepted", "Rejected"):
        return HTMLResponse(
            content=_build_already_responded_page(current_status, candidate_name, company_name),
            status_code=200
        )
    
    # Update status to Accepted
    db.employees.update_one(
        {"_id": ObjectId(employee_id)},
        {"$set": {
            "status": "Accepted",
            "offer_responded_at": datetime.utcnow(),
            "offer_response": "accepted"
        }}
    )
    
    return HTMLResponse(
        content=_build_response_page("accepted", candidate_name, company_name),
        status_code=200
    )


@router.get("/reject")
def reject_offer(token: str, db = Depends(database.get_db)):
    """Handle offer rejection from email link."""
    
    # Look up the token
    token_doc = db.offer_tokens.find_one({"token": token})
    
    if not token_doc:
        return HTMLResponse(content=_build_invalid_page(), status_code=404)
    
    employee_id = token_doc["employee_id"]
    company_name = token_doc.get("company_name", "The Company")
    
    # Get employee
    employee = db.employees.find_one({"_id": ObjectId(employee_id)})
    if not employee:
        return HTMLResponse(content=_build_invalid_page(), status_code=404)
    
    candidate_name = employee.get("name", "Candidate")
    current_status = employee.get("status", "")
    
    # Check if already responded
    if current_status in ("Accepted", "Rejected"):
        return HTMLResponse(
            content=_build_already_responded_page(current_status, candidate_name, company_name),
            status_code=200
        )
    
    # Update status to Rejected
    db.employees.update_one(
        {"_id": ObjectId(employee_id)},
        {"$set": {
            "status": "Rejected",
            "offer_responded_at": datetime.utcnow(),
            "offer_response": "rejected"
        }}
    )
    
    return HTMLResponse(
        content=_build_response_page("rejected", candidate_name, company_name),
        status_code=200
    )
