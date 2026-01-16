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
        return f"""
        Act as a professional HR Manager. Write a {letter_type} letter for:
        Name: {data.get('name')}
        Role: {data.get('role')}
        Department: {data.get('department')}
        Joining Date: {data.get('joining_date')}
        Salary: {data.get('ctc')}
        
        Tone: Professional and Welcoming.
        Keep it concise (max 300 words).
        """

    def _fallback_template(self, data, letter_type):
        """
        A hardcoded premium template for Arah Infotech Pvt Ltd.
        """
        if "offer" in letter_type.lower():
            return f"""
Arah Infotech Pvt Ltd
123, Tech Park, Innovation City, India
contact@arahinfotech.com | www.arahinfotech.com
------------------------------------------------------------

Date: {data.get('joining_date')}

Strictly Private & Confidential

To,
{data.get('name')}
{data.get('department')}

Subject: Offer of Employment

Dear {data.get('name')},

We are pleased to offer you the position of "{data.get('role')}" at Arah Infotech Pvt Ltd. We were impressed with your skills and experience during the interview process, and we believe you will be a valuable asset to our {data.get('department')} team.

1. REMUNERATION
Your Annual Cost to Company (CTC) will be {data.get('ctc', 'INR 0,00,000')}.

The detailed breakdown is as follows (Annexure A):

----------------------------------------------------
| COMPONENT              | ANNUAL AMOUNT           |
----------------------------------------------------
| Basic Salary           | {data.get('basic')} |
| HRA                    | {data.get('hra')} |
| Special Allowance      | {data.get('allowance')} |
| PF (Employer)          | {data.get('pf')} |
----------------------------------------------------
| TOTAL CTC              | {data.get('ctc')} |
----------------------------------------------------

2. DATE OF JOINING
Your scheduled date of joining will be {data.get('joining_date')}.

3. PROBATION PERIOD
You will be on a probation period of 6 months from the date of joining.

4. TERMS & CONDITIONS
This offer is subject to the verification of your credentials and successful completion of necessary background checks. You are required to submit self-attested copies of your educational and professional documents on the day of joining.

We are excited to have you onboard and look forward to a successful journey together.

Please sign and return the duplicate copy of this letter as a token of your acceptance.

For Arah Infotech Pvt Ltd,


(Signature)
HR Manager
"""
        else:
            return f"Dear {data.get('name')}, This is a formal letter regarding your {letter_type}."


# Singleton instance
ai_engine = AIService()
