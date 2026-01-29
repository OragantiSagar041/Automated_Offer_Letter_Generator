import requests
import json

class AIService:
    def __init__(self):
        # Default to local Ollama instance (common port 11434)
        self.local_ai_url = "http://localhost:11434/api/generate"
        self.model = "llama3" # You can change this to 'mistral' or others

    def generate_letter(self, employee_data, letter_type):
        """
        Generates a letter content using Local AI. 
        Falls back to a Template if AI is not available.
        """
        prompt = self._build_prompt(employee_data, letter_type)
        
        try:
            # Try connecting to Local AI (Ollama)
            response = requests.post(
                self.local_ai_url,
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=5 # Short timeout to check if AI is running
            )
            
            if response.status_code == 200:
                return response.json().get("response", "")
            else:
                print("Local AI returned error, ensuring fallback.")
                return self._fallback_template(employee_data, letter_type)
                
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            print("Local AI not responding (is Ollama running?). Using Rule-Based Fallback.")
            return self._fallback_template(employee_data, letter_type)

    def _build_prompt(self, data, letter_type):
        role = data.get('role', '').lower()
        is_internor_trainee = "intern" in role or "trainee" in role
        
        length_instruction = (
            "Keep the letter extremely concise and ensure it fits on a single page. Remove unnecessary fluff. " 
            "Focus strictly on Role, Joining Date, and Terms."
            if is_internor_trainee 
            else 
            "Write a detailed and professional letter. It can be lengthy and comprehensive."
        )

        return f"""
        Act as a professional HR Manager. Write a {letter_type} letter for:
        Name: {data.get('name')}
        Role: {data.get('role')}
        Department: {data.get('department')}
        Joining Date: {data.get('joining_date')}
        Date of Letter: {data.get('current_date')}
        Salary: {data.get('ctc')}
        
        Tone: Professional and Welcoming.
        {length_instruction}
        
        IMPORTANT: If Salary is 0, '0', or 'INR 0', DO NOT include any Remuneration, Salary, or CTC section in the letter. Treat it as an Internship Offer without pay.
        """

    def _fallback_template(self, data, letter_type):
        """
        A hardcoded premium template for Arah Infotech Pvt Ltd.
        """
        if "offer" in letter_type.lower():
            # Check if intern (CTC is 0)
            ctc_val = str(data.get('ctc', '0')).replace(',', '').replace('INR', '').strip()
            try:
                is_intern = float(ctc_val) == 0
            except ValueError:
                is_intern = False

            remuneration_section = ""
            if not is_intern:
                remuneration_section = f"""
    <div style="margin-top: 20px;">
        <h3>1. REMUNERATION</h3>
        <p>Your Annual Cost to Company (CTC) will be <strong>{data.get('ctc', 'INR 0,00,000')}</strong>.</p>
        <p>The detailed breakdown is as follows (Annexure A):</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #ddd;">
            <tr style="background-color: #f2f2f2;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">COMPONENT</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">ANNUAL AMOUNT</th>
            </tr>
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">Basic Salary</td>
                <td style="border: 1px solid #ddd; padding: 8px;">{data.get('basic')}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">HRA</td>
                <td style="border: 1px solid #ddd; padding: 8px;">{data.get('hra')}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">Special Allowance</td>
                <td style="border: 1px solid #ddd; padding: 8px;">{data.get('allowance')}</td>
            </tr>
             <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">PF (Employer)</td>
                <td style="border: 1px solid #ddd; padding: 8px;">{data.get('pf')}</td>
            </tr>
            <tr style="font-weight: bold;">
                <td style="border: 1px solid #ddd; padding: 8px;">TOTAL CTC</td>
                <td style="border: 1px solid #ddd; padding: 8px;">{data.get('ctc')}</td>
            </tr>
        </table>
    </div>
"""

            # HTML Template
            return f"""
    <div style="font-family: 'Arial', sans-serif; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #0056b3; padding-bottom: 20px; margin-bottom: 20px;">
            <img src="/arah_logo.jpg" alt="Arah Infotech" style="max-width: 150px; height: auto; margin-bottom: 15px;" />
            <h1 style="color: #0056b3; margin: 0;">Arah Infotech Pvt Ltd</h1>
            <p style="margin: 5px 0; color: #666;">123, Tech Park, Innovation City, India</p>
            <p style="margin: 0; color: #666;">contact@arahinfotech.com | www.arahinfotech.com</p>
        </div>

        <div class="date-row" style="text-align: right; font-weight: bold; margin-bottom: 20px;">
            <span>Date: {data.get('current_date')}</span>
        </div>
        <p style="color: #d9534f; font-weight: bold;">Strictly Private & Confidential</p>

        <p>To,<br>
        <strong>{data.get('name')}</strong><br>
        {data.get('department')}</p>

        <h3 style="color: #333; text-decoration: underline;">Subject: Offer of Employment</h3>

        <p>Dear <strong>{data.get('name')}</strong>,</p>

        <p>We are pleased to offer you the position of <strong>"{data.get('role')}"</strong> at Arah Infotech Pvt Ltd. We were impressed with your skills and experience during the interview process, and we believe you will be a valuable asset to our {data.get('department')} team.</p>

        {remuneration_section}

        <div style="margin-top: 10px;">
            <h3>{ "2" if not is_intern else "1" }. DATE OF JOINING</h3>
            <p>Your scheduled date of joining will be <strong>{data.get('joining_date')}</strong>.</p>
        </div>

        <div style="margin-top: 10px;">
            <h3>{ "3" if not is_intern else "2" }. PROBATION PERIOD</h3>
            <p>You will be on a probation period of 6 months from the date of joining.</p>
        </div>

        <div style="margin-top: 10px;">
            <h3>{ "4" if not is_intern else "3" }. TERMS & CONDITIONS</h3>
            <p>This offer is subject to the verification of your credentials and successful completion of necessary background checks.</p>
        </div>

        <p style="margin-top: 15px;">We are excited to have you onboard!</p>

        <div class="signature-block" style="margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div style="text-align: left;">
                <p>For Arah Infotech Pvt Ltd,</p>
            </div>
            
            <div style="text-align: left; width: 200px;">
                <p style="border-top: 1px solid #333; padding-top: 5px; margin: 0;">Authorized Signatory</p>
                <p style="font-weight: bold; margin: 5px 0 0 0;">HR Manager</p>
            </div>
        </div>
    </div>
"""

        elif "experience" in letter_type.lower():
            return f"""
TO WHOM IT MAY CONCERN

Date: {data.get('current_date', '2026-01-19')}

This is to certify that Mr./Ms. {data.get('name')} was employed with Arah Infotech Pvt Ltd as "{data.get('role')}" in the {data.get('department')} Department.

Tenure: {data.get('joining_date')} to Present

During their tenure with us, we found them to be sincere, hardworking, and dedicated. They have displayed professional conduct and successfully handled major responsibilities.

We wish them all the best in their future endeavors.

For Arah Infotech Pvt Ltd,


(Signature)
HR Manager
"""

        elif "relieving" in letter_type.lower():
            return f"""
RELIEVING LETTER

Date: {data.get('current_date', '2026-01-19')}

To,
{data.get('name')}
{data.get('role')}

Subject: Relieving from duties

Dear {data.get('name')},

This has reference to your resignation letter. We would like to inform you that your resignation has been accepted, and you are relieved from your duties at Arah Infotech Pvt Ltd effective from closing hours of today.

We certify that you have no pending dues or company assets.

We wish you success in your future career.

For Arah Infotech Pvt Ltd,


(Signature)
HR Manager
"""

        elif "appraisal" in letter_type.lower():
            return f"""
APPRAISAL LETTER

Date: {data.get('current_date', '2026-01-19')}

To,
{data.get('name')}
{data.get('role')}

Subject: Performance Appraisal & Salary Revision

Dear {data.get('name')},

In recognition of your performance and contribution to Arah Infotech Pvt Ltd during the last year, the management is pleased to revise your remuneration.

Revised Designation: {data.get('role')} (Senior Grade)
Revised CTC: {data.get('ctc')} (Effective from next month)

We look forward to your continued contribution and wish you a successful career with us.

For Arah Infotech Pvt Ltd,


(Signature)
HR Manager
"""
        
        else:
            return f"Dear {data.get('name')}, This is a formal letter regarding your {letter_type}."


# Singleton instance
ai_engine = AIService()
