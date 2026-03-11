class AgreementAIService:
    def __init__(self):
        pass

    def generate_letter(self, employee_data, letter_type):
        """
        Generates the exact agreement template without AI hallucination.
        """
        return self._fallback_template(employee_data, letter_type)

    def _fallback_template(self, data, letter_type):
        """
        The EXACT agreement template matching the Vagarious Solutions reference PDF.
        Each numbered section is wrapped in <div class="section-block"> to prevent
        orphan headings (heading at bottom of page, content on next page).
        """
        company = data.get('company_name', 'Arah Infotech Pvt Ltd')
        partner_company = data.get('name', 'Partner Company')
        percentage = data.get('percentage', 0)
        partner_address = data.get('address', '')
        joining_date = data.get('joining_date')
        if not joining_date:
            joining_date = data.get('current_date', '')
        
        # If the date includes time, cleanly format it
        if joining_date and " " in str(joining_date):
            joining_date = str(joining_date).split(" ")[0]
            
        replacement = data.get('replacement')
        if not replacement:
            replacement = 60
            
        invoice_post_joining = data.get('invoice_post_joining')
        if not invoice_post_joining:
            invoice_post_joining = 45
            
        payment_release = data.get('payment_release')
        if not payment_release:
            payment_release = 15
            
        signature = data.get('signature')
        if not signature:
            signature = 'Authorized Signatory'
        
        # Split signature into name and designation if " - " separator is used
        sig_name = signature
        sig_designation = ''
        if ' - ' in signature:
            parts = signature.split(' - ', 1)
            sig_name = parts[0].strip()
            sig_designation = parts[1].strip()
        
        # Company registered office addresses
        COMPANY_ADDRESSES = {
            'Arah Infotech Pvt Ltd': 'Ground Floor, Shanmukh Emmpire, Ayyappa Society, Main Road, Madhapur, Hyderabad, Telangana - 500081',
            'VAGARIOUS SOLUTIONS PVT LTD': 'Plot No. 1208, Flat No. 201, 2nd Floor, Spline Arcade, Ayyappa Society Main Road, Sri Sai Nagar, Madhapur, Hyderabad, Telangana - 500081',
            'UP LIFE INDIA PVT LTD': 'Ground Floor, Shanmukh Emmpire, 83, Ayyappa Society, Mega Hills, Madhapur, Hyderabad, Telangana - 500081',
            'ZERO7 TECHNOLOGIES TRAINING & DEVELOPMENT': 'Ground Floor, Shanmukh Emmpire, Ayyappa Society, Main Road, Madhapur, Hyderabad, Telangana - 500081',
        }
        
        # Look up company address (case-insensitive match)
        company_address = ''
        for key, addr in COMPANY_ADDRESSES.items():
            if key.lower() in company.lower() or company.lower() in key.lower():
                company_address = addr
                break
        if not company_address:
            company_address = COMPANY_ADDRESSES.get('Arah Infotech Pvt Ltd', '')
        
        return f"""<div style="font-family: Arial, Helvetica, sans-serif; color: #000; line-height: 1.6; max-width: 800px; margin: 0 auto; text-align: justify; padding-bottom: 50px;">

<h3 style="text-align: center; text-decoration: underline; font-size: 13px; margin-bottom: 30px; word-wrap: break-word; overflow-wrap: break-word;">AGREEMENT B/W {company.upper()} - {partner_company}</h3>

<p style="margin-bottom: 20px;">This Agreement is made and entered into on <strong>{joining_date}</strong> by and between:</p>

<p style="margin-bottom: 5px;"><strong>{company.upper()}</strong></p>
<p style="margin-bottom: 5px;">Registered Office: {company_address}</p>
<p style="margin-bottom: 20px;">(Hereinafter referred to as &ldquo;{company}&rdquo; or the &ldquo;Service Provider&rdquo;) <strong>AND</strong></p>

<p style="margin-bottom: 5px;"><strong>{partner_company}</strong></p>
<p style="margin-bottom: 5px;">{partner_address}</p>
<p style="margin-bottom: 20px;">&ldquo;Parties.&rdquo;</p>


<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">RECITALS</h4>
<p>WHEREAS, the Client is engaged in the field of Information Technology and Services;</p>
<p>WHEREAS, {company} is engaged in human resource management and consultancy services, including recruitment, training, and business process outsourcing;</p>
<p>WHEREAS, the Client desires to avail recruitment services, and {company} has represented that it possesses the skills, expertise, and resources to provide such services;</p>
<p><strong>NOW, THEREFORE,</strong> in consideration of the mutual covenants herein, the Parties agree as follows:</p>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">1. CONTRACT TERM</h4>
<ul>
<li>This Agreement shall remain valid for 12 months from the date of signing unless terminated earlier as per Clause 11.</li>
<li>Upon expiry, this Agreement may be extended by mutual written consent.</li>
<li>The Client reserves the right to appoint multiple vendors. {company} acknowledges that its appointment is non-exclusive.</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">2. PROFESSIONAL FEES</h4>
<ul>
<li>The Client shall pay {company} professional charges as follows:</li>
<li>All Levels &ndash; <strong>{percentage}%</strong> of Annual CTC (Applicable GST extra).</li>
<li>Annual CTC shall include Basic Salary, HRA, PF, LTA, Medical, Conveyance, and other fixed allowances. It shall exclude sales incentives, performance bonuses, and stock options.</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">3. SERVICE METHODOLOGY</h4>
<ul>
<li>The Client shall share requirements via email/telephone.</li>
<li>{company} shall confirm within 7 working days its ability to provide candidates.</li>
<li>{company} shall shortlist and submit resumes matching the Client&rsquo;s requirements.</li>
<li>The Client shall review resumes and provide feedback within 2 working days. During this time, {company} shall not propose the same candidates elsewhere.</li>
<li>If the Client confirms a candidate already exists in its database, no fee shall apply.</li>
<li>{company} shall coordinate interviews and follow up until candidate joining.</li>
<li>If a candidate is hired within 3 months of initial submission (including via Client advertisements), service charges shall apply.</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">4. INVOICES &amp; PAYMENT TERMS</h4>
<ul>
<li>On confirmation of candidate joining, {company} shall raise an invoice <strong>{invoice_post_joining} days</strong> post joining.</li>
<li>The Client shall process payment within <strong>{payment_release} days</strong> of invoice date, after deduction of applicable taxes.</li>
<li>Fees are payable irrespective of whether the candidate is on trial or probation.</li>
<li>No payment is due if a candidate absconds or resigns within 90 days of joining.</li>
<li>In case of duplicate referrals, payment shall be made to the vendor whose reference was received first.</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">5. REPLACEMENT GUARANTEE</h4>
<ul>
<li>If a candidate absconds in <strong>{replacement} Days</strong> replacement is applicable and {company} shall provide a replacement within 10 working days.</li>
<li>If the candidate is terminated due to misconduct, breach of confidentiality, or non-performance by the company after <strong>60 days</strong>, {company} shall not provide a replacement, but, if he is terminated in 60 Days {company.lower()} will provide replacement.</li>
<li>If replacement is not provided, the professional fee shall be refunded or adjusted against future invoices.</li>
<li>This guarantee does not apply if the Client terminates for business reasons.</li>
<li>The Client shall provide 1-week prior notice to {company} before termination for this guarantee to apply.</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">6. RESPONSIBILITIES OF {company.upper()}</h4>
<ul>
<li>Deliver services diligently and promote the Client&rsquo;s interests.</li>
<li>Not forward selected candidates to other clients until released by the Client.</li>
<li>Arrange interviews at mutually convenient times.</li>
<li>Notify the Client if a proposed candidate accepts another assignment.</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">7. CONFIDENTIALITY &amp; NON-SOLICITATION</h4>
<ul>
<li>{company} shall not disclose Client&rsquo;s confidential information or business practices.</li>
<li>{company} shall not solicit or influence Client employees.</li>
<li>This clause survives the termination of this Agreement</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">8. NON-ASSIGNMENT</h4>
<ul>
<li>This Agreement shall not be assigned by {company} to any third party without prior written consent of the Client.</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">9. DISPUTE RESOLUTION &amp; ARBITRATION</h4>
<ul>
<li>Any dispute shall be referred to arbitration under the Arbitration and Conciliation Act, 1996.</li>
<li>A sole arbitrator shall be appointed with mutual consent.</li>
<li>The arbitration shall be conducted in Hyderabad, in the English language.</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">10. GOVERNING LAW &amp; JURISDICTION</h4>
<ul>
<li>This Agreement shall be governed by the laws of India. Courts at Hyderabad and Secunderabad shall have exclusive jurisdiction.</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">11. TERMINATION</h4>
<ul>
<li>Either Party may terminate this Agreement with 30 days&rsquo; prior written notice.</li>
<li>The Client may terminate immediately without notice if {company} breaches terms.</li>
<li>No service fee shall be payable for placements made after termination unless the Agreement is renewed.</li>
</ul>
</div>

<div class="section-block">
<h4 style="text-decoration: underline; margin-top: 25px;">12. ENTIRE AGREEMENT</h4>
<ul>
<li>This Agreement constitutes the entire understanding between the Parties and supersedes all prior discussions. Any amendments shall be in writing and signed by both Parties.</li>
</ul>
</div>

<br>
<p><strong>IN WITNESS WHEREOF,</strong> the Parties hereto have executed this Agreement on the date first above written.</p>

<table style="width: 100%; margin-top: 40px; border: none; border-collapse: collapse;">
<tbody>
<tr>
<td style="text-align: left; width: 50%; border: none; vertical-align: top; padding: 0;"><strong>{company.upper()}</strong></td>
<td style="text-align: left; width: 50%; border: none; vertical-align: top; padding: 0;"><strong>{partner_company}</strong></td>
</tr>
<tr>
<td style="border: none; padding: 10px 0 0px 0;">
    <img src="/signature_transparent.png" alt="Signature" style="height: 60px; display: block; margin-top: 10px; margin-bottom: 5px;">
</td>
<td style="border: none; padding: 40px 0 10px 0;"></td>
</tr>
<tr>
<td style="border: none; padding: 5px 0;"><strong>NAME :</strong>{sig_name}</td>
<td style="border: none; padding: 5px 0;"><strong>NAME :</strong></td>
</tr>
<tr>
<td style="border: none; padding: 5px 0;"><strong>DESIGNATION :</strong> {sig_designation if sig_designation else 'MANAGING DIRECTOR'}</td>
<td style="border: none; padding: 5px 0;"><strong>DESIGNATION :</strong></td>
</tr>
</tbody>
</table>
</div>"""

# Singleton instance
agreement_ai_engine = AgreementAIService()
