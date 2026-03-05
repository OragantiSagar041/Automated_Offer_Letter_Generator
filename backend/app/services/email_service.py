import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import os
from dotenv import load_dotenv
import requests
import base64
import uuid
from datetime import datetime

# Load environment variables from .env file
from pathlib import Path
env_path = Path(__file__).resolve().parent.parent.parent.parent / "backend" / ".env"
base_path = Path(__file__).resolve().parent.parent.parent
dotenv_path = base_path / ".env"

if dotenv_path.exists():
    load_dotenv(dotenv_path=dotenv_path, override=True)
else:
    load_dotenv(override=True)

# MongoDB connection for token storage
from ..database import db as mongo_db

class EmailService:
    def __init__(self):
        # SMTP Config
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = os.getenv("MAIL_USERNAME", "").strip()
        self.sender_password = os.getenv("MAIL_PASSWORD", "").strip()
        
        # Brevo API Config
        self.brevo_api_key = os.getenv("BREVO_API_KEY", "").strip()
        self.brevo_sender_email = os.getenv("BREVO_SENDER_EMAIL", self.sender_email).strip()

        # Backend URL for offer response links
        self.backend_url = os.getenv("BACKEND_URL", os.getenv("RENDER_EXTERNAL_URL", "https://automated-offer-letter-generator.onrender.com")).strip().rstrip('/')

        # Debug Logging
        print(f"DEBUG: EmailService Init")
        print(f"DEBUG: DOTENV Path checked: {dotenv_path}")
        print(f"DEBUG: Brevo Key loaded: {'YES' if self.brevo_api_key else 'NO'} (Length: {len(self.brevo_api_key)})")
        print(f"DEBUG: Brevo Sender: {self.brevo_sender_email}")
        print(f"DEBUG: Backend URL: {self.backend_url}")
        
    def _generate_offer_token(self, employee_id, company_name):
        """Generate a unique token and store it in MongoDB for offer response tracking."""
        token = str(uuid.uuid4())
        
        # Remove any existing token for this employee (one active token per employee)
        mongo_db.offer_tokens.delete_many({"employee_id": employee_id})
        
        # Store new token
        mongo_db.offer_tokens.insert_one({
            "token": token,
            "employee_id": employee_id,
            "company_name": company_name,
            "created_at": datetime.utcnow()
        })
        
        return token

    def _build_email_html(self, body_html, accept_url, reject_url, company_name):
        """Build a premium HTML email with Accept/Reject buttons."""
        return f'''
        <div style="font-family: 'Segoe UI', Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px 40px; text-align: center;">
                <h2 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">{company_name}</h2>
                <p style="color: #94a3b8; margin: 8px 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px;">Official Communication</p>
            </div>
            
            <!-- Body -->
            <div style="padding: 40px;">
                <div style="font-size: 15px; line-height: 1.7; color: #334155;">
                    {body_html}
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div style="padding: 0 40px 40px; text-align: center;">
                <p style="color: #64748b; font-size: 13px; margin-bottom: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Please respond to this offer:
                </p>
                <div style="display: inline-block;">
                    <a href="{accept_url}" 
                       style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; margin-right: 12px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                        ✅ I Accept the Offer
                    </a>
                    <a href="{reject_url}" 
                       style="display: inline-block; background: #ffffff; color: #475569; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; border: 2px solid #cbd5e1;">
                        Decline Offer
                    </a>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                    This is an automated email from {company_name}. Please do not reply directly.
                </p>
                <p style="color: #cbd5e1; font-size: 11px; margin: 8px 0 0;">
                    © {datetime.now().year} {company_name}. All rights reserved.
                </p>
            </div>
        </div>
        '''

    def send_via_brevo(self, recipient_email, candidate_name, subject, body, pdf_content=None, company_name="Arah Infotech Pvt Ltd"):
        url = "https://api.brevo.com/v3/smtp/email"
        
        headers = {
            "accept": "application/json",
            "api-key": self.brevo_api_key,
            "content-type": "application/json"
        }
        
        sender_email = self.brevo_sender_email if self.brevo_sender_email else self.sender_email
        
        payload = {
            "sender": {"name": f"{company_name} HR", "email": sender_email},
            "to": [{"email": recipient_email, "name": candidate_name}],
            "subject": subject,
            "htmlContent": body
        }
        
        if pdf_content:
            try:
                if isinstance(pdf_content, bytes):
                    b64_content = base64.b64encode(pdf_content).decode('utf-8')
                else:
                    b64_content = pdf_content
                    
                payload["attachment"] = [
                    {
                        "content": b64_content,
                        "name": f"Offer_Letter_{candidate_name.replace(' ', '_')}.pdf"
                    }
                ]
            except Exception as e:
                print(f"Error encoding PDF for Brevo: {e}")
                
        try:
            response = requests.post(url, json=payload, headers=headers)
            if response.status_code == 201 or response.status_code == 200:
                return {"status": "success", "message": "Email sent successfully via Brevo"}
            else:
                 print(f"Brevo API Error: {response.text}")
                 return {"status": "error", "message": f"Brevo API Error: {response.text}"}
        except Exception as e:
             print(f"Brevo Exception: {str(e)}")
             return {"status": "error", "message": str(e)}

    def send_offer_letter(self, recipient_email, candidate_name, pdf_content=None, letter_content=None, email_body=None, subject=None, company_name="Arah Infotech Pvt Ltd", employee_id=None):
        """
        Sends an email with the offer letter and Accept/Reject action buttons.
        """
        # Use provided subject or default
        if not subject:
            subject = f"Offer of Employment - {candidate_name}"
            
        # Build body HTML from the email message
        if email_body:
            base_html = email_body.replace('\n', '<br>')
        else:
            base_html = f"Dear {candidate_name},<br><br>Congratulations! We are pleased to offer you a position at {company_name}.<br><br>Please find the offer letter attached.<br><br>Regards,<br>HR Team"
        
        # Generate token and build Accept/Reject URLs
        if employee_id:
            token = self._generate_offer_token(employee_id, company_name)
            accept_url = f"{self.backend_url}/offer/accept?token={token}"
            reject_url = f"{self.backend_url}/offer/reject?token={token}"
        else:
            # Fallback to mailto: if no employee_id (shouldn't normally happen)
            sender_email = self.brevo_sender_email if self.brevo_sender_email else self.sender_email
            accept_url = f"mailto:{sender_email}?subject=I%20Accept%20Offer&body=I%20Accept%20Offer"
            reject_url = f"mailto:{sender_email}?subject=Not%20Interested&body=Not%20Interested"
        
        # Build the final premium email HTML
        final_body = self._build_email_html(base_html, accept_url, reject_url, company_name)

        # PRIORITY: Use Brevo API if Key exists
        if self.brevo_api_key:
            return self.send_via_brevo(recipient_email=recipient_email, candidate_name=candidate_name, subject=subject, body=final_body, pdf_content=pdf_content, company_name=company_name)

        # FALLBACK: Use Gmail SMTP
        try:
            msg = MIMEMultipart()
            msg['From'] = f'"{company_name} HR" <{self.sender_email}>'
            msg['To'] = recipient_email
            msg['Subject'] = subject

            msg.attach(MIMEText(final_body, 'html'))
            
            # Attach PDF if provided
            if pdf_content:
                pdf_attachment = MIMEApplication(pdf_content, _subtype="pdf")
                pdf_attachment.add_header('Content-Disposition', 'attachment', filename=f"Offer_Letter_{candidate_name.replace(' ', '_')}.pdf")
                msg.attach(pdf_attachment)

            # Fallback Text if no PDF
            if letter_content and not pdf_content:
                 msg.attach(MIMEText(f"\n\n--- OFFER LETTER TEXT ---\n{letter_content}", 'plain'))

            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.sender_email, self.sender_password)
            server.send_message(msg)
            server.quit()
            
            return {"status": "success", "message": "Email sent successfully"}

        except Exception as e:
            print(f"Error sending email: {e}")
            return {"status": "error", "message": str(e)}

email_client = EmailService()

