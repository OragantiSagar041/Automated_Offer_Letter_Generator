import requests
import json
import os

class AIService:
    def __init__(self):
        # Default to local Ollama instance (common port 11434)
        self.local_ai_url = "http://localhost:11434/api/generate"
        self.model = "llama3" # You can change this to 'mistral' or others
        
        # Load signature image as base64 for inline embedding in PDFs
        sig_path = os.path.join(os.path.dirname(__file__), 'signature_b64.txt')
        try:
            with open(sig_path, 'r') as f:
                self.signature_b64 = f.read().strip()
        except:
            self.signature_b64 = ''

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
        company = data.get('company_name', 'Arah Infotech Pvt Ltd')
        is_internor_trainee = "intern" in role or "trainee" in role
        
        length_instruction = (
            "Keep the letter extremely concise and ensure it fits on a single page. Remove unnecessary fluff. " 
            "Focus strictly on Role, Joining Date, and Terms."
            if is_internor_trainee 
            else 
            "Write a detailed and professional letter. It can be lengthy and comprehensive."
        )

        return f"""
        Act as a professional HR Manager for {company}. Write a {letter_type} letter for:
        Name: {data.get('name')}
        Role: {data.get('role')}
        Department: {data.get('department')}
        Joining Date: {data.get('joining_date')}
        Date of Letter: {data.get('current_date')}
        Salary: {data.get('ctc')}
        Company: {company}
        
        Tone: Professional and Welcoming.
        {length_instruction}
        
        IMPORTANT: Use the company name '{company}' in the header and body.
        If Salary is 0, '0', or 'INR 0', DO NOT include any Remuneration, Salary, or CTC section in the letter. Treat it as an Internship Offer without pay.
        """

    def _number_to_indian_words(self, num):
        try:
            num = int(float(str(num).replace(',', '').replace('INR', '').strip()))
        except:
            return str(num)
        
        if num == 0:
            return "Zero"
            
        def convert_less_than_1000(n):
            ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
                    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
            tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
            if n < 20: return ones[n]
            if n < 100: return tens[n // 10] + (" " + ones[n % 10] if n % 10 != 0 else "")
            return ones[n // 100] + " Hundred" + (" " + convert_less_than_1000(n % 100) if n % 100 != 0 else "")
            
        res = ""
        if num >= 10000000:
            crores = num // 10000000
            res += convert_less_than_1000(crores) + " Crore "
            num %= 10000000
        if num >= 100000:
            lakhs = num // 100000
            res += convert_less_than_1000(lakhs) + " Lakh "
            num %= 100000
        if num >= 1000:
            thousands = num // 1000
            res += convert_less_than_1000(thousands) + " Thousand "
            num %= 1000
        if num > 0:
            res += convert_less_than_1000(num)
            
        return res.strip()

    def _format_lakhs(self, ctc_str):
        try:
            num = float(str(ctc_str).replace(',', '').replace('INR', '').strip())
            return f"INR {round(num / 100000, 2):.1f} Lakh per Annum."
        except:
            return f"{ctc_str} per Annum."

    def _fallback_template(self, data, letter_type):
        """
        A hardcoded premium template matching exact reference.
        """
        company = data.get('company_name', 'Arah Infotech Pvt Ltd')
        
        if "offer" in letter_type.lower() or "internship" in letter_type.lower():
            # Check if intern (CTC is 0)
            ctc_val = str(data.get('ctc', '0')).replace(',', '').replace('INR', '').strip()
            try:
                is_intern = float(ctc_val) == 0
            except ValueError:
                is_intern = False

            # Calculate exact words
            net_salary_raw = data.get('net_salary', '0')
            net_words = self._number_to_indian_words(net_salary_raw)
            ctc_lakhs = self._format_lakhs(data.get('ctc', '0'))

            # HTML Template - Page 1: Offer Letter Body
            page1 = f"""
    <div style="font-family: 'Arial', sans-serif; color: #000; font-size: 14.5px; line-height: 1.6; max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; min-height: 830px;">

        <div class="date-row" style="text-align: right; font-weight: bold; margin-bottom: 30px; margin-top: 10px;">
            <span style="display: inline-block;">Date : {data.get('current_date')}</span>
        </div>

        <p style="margin-bottom: 30px;"><strong>To,</strong></p>

        <p style="margin-bottom: 30px;">Dear <strong>{data.get('name')}</strong></p>

        <h3 style="text-align: center; color: #000; margin-bottom: 30px; font-size: 15px; font-weight: bold;">Subject: Offer of Employment</h3>

        <p style="margin-bottom: 20px;">We are pleased to offer you the position of <strong>{data.get('role')}</strong> with <strong>{company.upper()}</strong>. We are all excited about the potential that you will bring to our organization.</p>

        <p style="margin-bottom: 20px;">Your CTC would be <strong>{ctc_lakhs}</strong></p>

        <p style="margin-bottom: 20px;">The CTC would be subjected to all statutory deductions as applicable.</p>

        <p style="margin-bottom: 20px;">You are required to join us on <strong>{data.get('joining_date')}</strong> beyond which this offer stands cancelled unless otherwise either party communicates the said delay beforehand.</p>

        <p style="margin-bottom: 30px;">We look forward to your arrival as an employee of our organization and are confident that you will play a key role in our company's expansion. If this employment offer is acceptable to you, please sign a copy of this letter and return it to us by <strong>{data.get('joining_date')}</strong>.</p>

        <div style="margin-top: 40px;">
            <p style="margin-bottom: 20px;"><strong>Yours truly,</strong></p>
            <p style="margin-bottom: 20px;"><strong>For {company}</strong></p>
            <div style="height: 60px; margin-bottom: 10px;"><img src="data:image/png;base64,{self.signature_b64}" style="height: 60px; width: auto; border: none; outline: none; box-shadow: none;" /></div>
            <p style="margin: 0; font-weight: bold;">S Navya</p>
            <p style="margin: 0; font-weight: bold;">Managing Director</p>
        </div>
    </div>
"""

            # HTML Template - Page 2: Salary Annexure
            page2 = f"""
    <div style="font-family: 'Arial', sans-serif; color: #000; font-size: 14px; line-height: 1.6; max-width: 800px; margin: 0 auto; padding-top: 30px;">

        <h3 style="text-align: center; margin-bottom: 30px; font-size: 14px; font-weight: bold;">Annexure "A"</h3>

        <p style="margin-bottom: 30px; font-weight: bold; line-height: 1.4;">Entitlements: All entitlements listed below are subject to Company Policies, Procedures<br>and Guidelines that may be in force or as issued/changed from time to time. The Details<br>of your remuneration are as under:</p>

        <p style="font-weight: bold; text-decoration: underline; margin-bottom: 2px;">Salary Structure</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <tr style="font-weight: bold;">
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: left; width: 40%;"><strong>Particulars</strong></td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; width: 30%;"><strong>Monthly (Rs.)</strong></td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: center; width: 30%;"><strong>Annually (Rs.)</strong></td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 4px 6px;">Basic Salary</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('basic_monthly')}.00</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('basic')}.00</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 4px 6px;">HRA</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('hra_monthly')}.00</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('hra')}.00</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 4px 6px;">Conveyance</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('conveyance_monthly')}.00</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('conveyance')}.00</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 4px 6px;">Medical Allowance</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('medical_monthly')}.00</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('medical_allowance')}.00</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 4px 6px;">Special Allowance</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('special_monthly')}.00</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('special_allowance')}.00</td>
            </tr>
            
            <tr><td colspan="3" style="padding: 2px; border: 1px solid #000; border-bottom: none; border-top: none;">&nbsp;</td></tr>

            <tr style="font-weight: bold;">
                <td style="border: 1px solid #000; padding: 4px 6px;"><strong>Gross Amount</strong></td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;"><strong>{data.get('gross_monthly')}.00</strong></td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;"><strong>{data.get('gross_salary')}.00</strong></td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; font-weight: bold;"><strong>PT</strong></td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('pt_monthly') if float(data.get('pt_monthly') or 0) > 0 else ''}</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{data.get('pt') if float(data.get('pt') or 0) > 0 else ''}</td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 4px 6px; font-weight: bold;"><strong>PF</strong></td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{f"{data.get('pf_monthly')}.00" if float(data.get('pf_monthly') or 0) > 0 else ''}</td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{f"{data.get('pf')}.00" if float(data.get('pf') or 0) > 0 else ''}</td>
            </tr>
            <tr style="font-weight: bold;">
                <td style="border: 1px solid #000; padding: 4px 6px;"><strong>Net Pay</strong></td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;"><strong>{data.get('net_monthly')}.00</strong></td>
                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;"><strong>{data.get('net_salary')}.00</strong></td>
            </tr>
        </table>

        <p style="font-weight: bold; margin-bottom: 15px;">Rupees: {net_words} Rupees Only (Per Annum)</p>

        <p style="margin-bottom: 15px;">*Incentive/Referral/Bonus or any other variable amount is payable subject to the<br>employee’s performance as per Company Policies and at the Sole discretion of the<br>Company's management.</p>

        <p style="margin-bottom: 25px;">*Employee has to be in active roles at the time of actual payment and not serving any<br>notice period in order to be eligible for the payment.</p>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px;">
            <div style="text-align: left;">
                <p style="margin-bottom: 25px;">For {company}</p>
                <div style="height: 60px; margin-bottom: 15px;"><img src="data:image/png;base64,{self.signature_b64}" style="height: 60px; width: auto; border: none; outline: none; box-shadow: none;" /></div>
                <p style="margin: 0; font-weight: bold;">S Navya</p>
                <p style="margin: 0; font-weight: bold;">Managing Director</p>
            </div>
            
            <div style="text-align: center; margin-bottom: 0;">
                <p style="font-weight: bold; margin-bottom: 50px;">Agreed and accepted</p>
                <p style="margin: 0; font-weight: bold;">{data.get('name')}</p>
            </div>
        </div>
    </div>
"""
            return page1 + page2

        elif "experience" in letter_type.lower():
            return f"""
TO WHOM IT MAY CONCERN

Date: {data.get('current_date', '2026-01-19')}

This is to certify that Mr./Ms. {data.get('name')} was employed with {company} as "{data.get('role')}" in the {data.get('department')} Department.

Tenure: {data.get('joining_date')} to Present

During their tenure with us, we found them to be sincere, hardworking, and dedicated. They have displayed professional conduct and successfully handled major responsibilities.

We wish them all the best in their future endeavors.

For {company},


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

This has reference to your resignation letter. We would like to inform you that your resignation has been accepted, and you are relieved from your duties at {company} effective from closing hours of today.

We certify that you have no pending dues or company assets.

We wish you success in your future career.

For {company},


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

In recognition of your performance and contribution to {company} during the last year, the management is pleased to revise your remuneration.

Revised Designation: {data.get('role')} (Senior Grade)
Revised CTC: {data.get('ctc')} (Effective from next month)

We look forward to your continued contribution and wish you a successful career with us.

For {company},


(Signature)
HR Manager
"""
        
        else:
            return f"""
    <div style="font-family: 'Arial', sans-serif; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px solid #0056b3; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #0056b3; margin: 0;">{company}</h1>
            <p style="margin: 5px 0; color: #666;">123, Tech Park, Innovation City, India</p>
            <p style="margin: 0; color: #666;">contact@company.com</p>
        </div>

        <div class="date-row" style="text-align: right; font-weight: bold; margin-bottom: 20px;">
            <span>Date: {data.get('current_date')}</span>
        </div>

        <p>To,<br>
        <strong>{data.get('name')}</strong><br>
        {data.get('department')}</p>

        <h3 style="color: #333; text-decoration: underline;">Subject: {letter_type}</h3>

        <p>Dear <strong>{data.get('name')}</strong>,</p>

        <p>This is a formal letter regarding <strong>{letter_type}</strong> issued by {company}.</p>

        <p>Please find the details below:</p>
        
        <br><br>
        <p><i>[Content regarding {letter_type} to be inserted here...]</i></p>
        <br><br>

        <p>We appreciate your association with us.</p>

        <div class="signature-block" style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div style="text-align: left;">
                <p>For {company},</p>
            </div>
            
            <div style="text-align: left; width: 200px;">
                <p style="border-top: 1px solid #333; padding-top: 5px; margin: 0;">Authorized Signatory</p>
                <p style="font-weight: bold; margin: 5px 0 0 0;">HR Manager</p>
            </div>
        </div>
    </div>
"""


# Singleton instance
ai_engine = AIService()
