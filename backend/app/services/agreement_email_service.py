import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import os
from dotenv import load_dotenv
import requests
import base64

# Load environment variables
from pathlib import Path
base_path = Path(__file__).resolve().parent.parent.parent
dotenv_path = base_path / ".env"

if dotenv_path.exists():
    load_dotenv(dotenv_path=dotenv_path, override=True)
else:
    load_dotenv(override=True)

class AgreementEmailService:
    def __init__(self):
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = os.getenv("MAIL_USERNAME", "").strip()
        self.sender_password = os.getenv("MAIL_PASSWORD", "").strip()
        self.brevo_api_key = os.getenv("BREVO_API_KEY", "").strip()
        self.brevo_sender_email = os.getenv("BREVO_SENDER_EMAIL", self.sender_email).strip()

        print(f"DEBUG: AgreementEmailService Init")
        print(f"DEBUG: Brevo Key loaded: {'YES' if self.brevo_api_key else 'NO'}")

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
            "htmlContent": body.replace('\n', '<br>')
        }
        if pdf_content:
            try:
                if isinstance(pdf_content, bytes):
                    b64_content = base64.b64encode(pdf_content).decode('utf-8')
                else:
                    b64_content = pdf_content
                payload["attachment"] = [{"content": b64_content, "name": f"Agreement_{candidate_name.replace(' ', '_')}.pdf"}]
            except Exception as e:
                print(f"Error encoding PDF for Brevo: {e}")
        try:
            response = requests.post(url, json=payload, headers=headers)
            if response.status_code in (200, 201):
                return {"status": "success", "message": "Email sent successfully via Brevo"}
            else:
                print(f"Brevo API Error: {response.text}")
                return {"status": "error", "message": f"Brevo API Error: {response.text}"}
        except Exception as e:
            print(f"Brevo Exception: {str(e)}")
            return {"status": "error", "message": str(e)}

    def send_agreement(self, recipient_email, candidate_name, pdf_content=None, letter_content=None, email_body=None, subject=None, company_name="Arah Infotech Pvt Ltd"):
        if email_body:
            final_body = email_body
        else:
            final_body = f"Dear {candidate_name},\n\nPlease find the agreement document attached.\n\nRegards,\nHR Team"
        if not subject:
            subject = f"Agreement - {candidate_name}"

        if self.brevo_api_key:
            return self.send_via_brevo(recipient_email=recipient_email, candidate_name=candidate_name, subject=subject, body=final_body, pdf_content=pdf_content, company_name=company_name)

        try:
            msg = MIMEMultipart()
            msg['From'] = self.sender_email
            msg['To'] = recipient_email
            msg['Subject'] = subject
            msg.attach(MIMEText(final_body, 'plain'))
            if pdf_content:
                pdf_attachment = MIMEApplication(pdf_content, _subtype="pdf")
                pdf_attachment.add_header('Content-Disposition', 'attachment', filename=f"Agreement_{candidate_name.replace(' ', '_')}.pdf")
                msg.attach(pdf_attachment)
            if letter_content and not pdf_content:
                msg.attach(MIMEText(f"\n\n--- AGREEMENT TEXT ---\n{letter_content}", 'plain'))
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.sender_email, self.sender_password)
            server.send_message(msg)
            server.quit()
            return {"status": "success", "message": "Email sent successfully"}
        except Exception as e:
            print(f"Error sending email: {e}")
            return {"status": "error", "message": str(e)}

agreement_email_client = AgreementEmailService()
