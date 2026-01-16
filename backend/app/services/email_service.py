import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class EmailService:
    def __init__(self):
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = os.getenv("MAIL_USERNAME").strip() if os.getenv("MAIL_USERNAME") else None
        self.sender_password = os.getenv("MAIL_PASSWORD").strip() if os.getenv("MAIL_PASSWORD") else None


    def send_offer_letter(self, recipient_email, candidate_name, pdf_content=None, letter_content=None, email_body=None):
        """
        Sends an email with the offer letter.
        """
        try:
            msg = MIMEMultipart()
            msg['From'] = self.sender_email
            msg['To'] = recipient_email
            msg['Subject'] = f"Offer of Employment - {candidate_name}"

            if email_body:
                # Use custom message
                final_body = email_body
            else:
                # Default Template
                final_body = f"""
            Dear {candidate_name},

            Congratulations! We are pleased to offer you a position at Arah Infotech Pvt Ltd.
            
            Please find the offer letter attached.

            Regards,
            HR Team
            """
            msg.attach(MIMEText(final_body, 'plain'))
            
            # Attach PDF if provided
            if pdf_content:
                pdf_attachment = MIMEApplication(pdf_content, _subtype="pdf")
                pdf_attachment.add_header('Content-Disposition', 'attachment', filename=f"Offer_Letter_{candidate_name.replace(' ', '_')}.pdf")
                msg.attach(pdf_attachment)

            # Fallback Text if no PDF (or just inline text)
            if letter_content and not pdf_content:
                 msg.attach(MIMEText(f"\n\n--- OFFER LETTER TEXT ---\n{letter_content}", 'plain'))

            # Real Send Mode
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
