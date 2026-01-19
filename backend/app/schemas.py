from pydantic import BaseModel
from datetime import date
from typing import Optional, List

# Employee Schemas
class EmployeeBase(BaseModel):
    emp_id: str
    name: str
    email: str
    designation: str
    department: str
    joining_date: date
    location: str

class EmployeeCreate(EmployeeBase):
    ctc: float
    basic_salary: float

class Employee(EmployeeBase):
    id: int
    status: Optional[str] = "Pending"

    class Config:
        from_attributes = True

# Payroll Schemas
class PayrollBase(BaseModel):
    basic_salary: float
    hra: float
    allowances: float
    deductions: float
    net_salary: float
    month: str
    year: int

class PayrollCreate(PayrollBase):
    emp_id: int

class Payroll(PayrollBase):
    id: int
    emp_id: int

    class Config:
        from_attributes = True

# Letter Schemas
class LetterRequest(BaseModel):
    employee_id: int
    letter_type: str # "Offer", "Appraisal", etc.
    tone: Optional[str] = "Professional"

class EmailRequest(BaseModel):
    employee_id: int
    letter_content: str
    pdf_base64: str
    custom_message: Optional[str] = None
    subject: Optional[str] = None

class LetterResponse(BaseModel):
    content: str
    file_path: Optional[str] = None
