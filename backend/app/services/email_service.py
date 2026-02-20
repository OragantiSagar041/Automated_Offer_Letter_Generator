import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import os
from dotenv import load_dotenv
import requests
import base64

# Load environment variables from .env file
# Load environment variables from .env file
# Try loading from specific paths to ensure it finds it
from pathlib import Path
env_path = Path(__file__).resolve().parent.parent.parent.parent / "backend" / ".env" # Adjust based on file structure: services -> app -> backend -> .env? 
# Structure: backend/app/services/email_service.py -> parent=services, parent=app, parent=backend.
# So .parent.parent.parent should be 'backend' folder.
base_path = Path(__file__).resolve().parent.parent.parent
dotenv_path = base_path / ".env"

if dotenv_path.exists():
    load_dotenv(dotenv_path=dotenv_path, override=True)
else:
    load_dotenv(override=True) # Fallback to default search

class EmailService:
    def __init__(self):
        # SMTP Config
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = os.getenv("MAIL_USERNAME", "").strip()
        self.sender_password = os.getenv("MAIL_PASSWORD", "").strip()
        
        # Brevo API Config
        self.brevo_api_key = os.getenv("BREVO_API_KEY", "").strip()
        self.brevo_sender_email = os.getenv("BREVO_SENDER_EMAIL", self.sender_email).strip() # Fallback to MAIL_USERNAME if not set

        # Debug Logging
        print(f"DEBUG: EmailService Init")
        print(f"DEBUG: DOTENV Path checked: {dotenv_path}")
        print(f"DEBUG: Brevo Key loaded: {'YES' if self.brevo_api_key else 'NO'} (Length: {len(self.brevo_api_key)})")
        print(f"DEBUG: Brevo Sender: {self.brevo_sender_email}")
        
    def send_via_brevo(self, recipient_email, candidate_name, subject, body, pdf_content=None, company_name="Arah Infotech Pvt Ltd"):
        url = "https://api.brevo.com/v3/smtp/email"
        
        headers = {
            "accept": "application/json",
            "api-key": self.brevo_api_key,
            "content-type": "application/json"
        }
        
        # Ensure sender email is valid (Brevo requires verified sender)
        sender_email = self.brevo_sender_email if self.brevo_sender_email else self.sender_email
        
        payload = {
            "sender": {"name": f"{company_name} HR", "email": sender_email},
            "to": [{"email": recipient_email, "name": candidate_name}],
            "subject": subject,
            "htmlContent": body.replace('\n', '<br>') # Brevo uses htmlContent
        }
        
        if pdf_content:
            # Brevo expects base64 encoded content
            try:
                # If pdf_content is bytes, encode it. If it's already base64 string, use it.
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
            if response.status_code == 201 or response.status_code == 200: # 201 Created or 200 OK
                return {"status": "success", "message": "Email sent successfully via Brevo"}
            else:
                 print(f"Brevo API Error: {response.text}") # Log error details
                 return {"status": "error", "message": f"Brevo API Error: {response.text}"}
        except Exception as e:
             print(f"Brevo Exception: {str(e)}")
             return {"status": "error", "message": str(e)}

    def send_offer_letter(self, recipient_email, candidate_name, pdf_content=None, letter_content=None, email_body=None, subject=None, company_name="Arah Infotech Pvt Ltd"):
        """
        Sends an email with the offer letter.
        """
        # Define Body
        if email_body:
            final_body = email_body
        else:
            final_body = f"""
            Dear {candidate_name},

            Congratulations! We are pleased to offer you a position at {company_name}.
            
            Please find the offer letter attached.

            Regards,
            HR Team
            """
        
        # Use provided subject or default
        if not subject:
            subject = f"Offer of Employment - {candidate_name}"

        # PRIORITY: Use Brevo API if Key exists
        if self.brevo_api_key:
            return self.send_via_brevo(recipient_email=recipient_email, candidate_name=candidate_name, subject=subject, body=final_body, pdf_content=pdf_content, company_name=company_name)

        # FALLBACK: Use Gmail SMTP
        try:
            msg = MIMEMultipart()
            msg['From'] = self.sender_email
            msg['To'] = recipient_email
            msg['Subject'] = subject

            msg.attach(MIMEText(final_body, 'plain'))
            
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
