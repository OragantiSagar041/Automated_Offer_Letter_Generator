from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime, Text
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import date, datetime

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    emp_id = Column(String(50), unique=True, index=True)
    name = Column(String(100))
    email = Column(String(100), unique=True)
    designation = Column(String(100))
    department = Column(String(100))
    joining_date = Column(Date)
    location = Column(String(100))
    status = Column(String, default="Pending")
    
    payrolls = relationship("Payroll", back_populates="employee")
    letters = relationship("GeneratedLetter", back_populates="employee")

class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(Integer, primary_key=True, index=True)
    emp_id = Column(Integer, ForeignKey("employees.id"))
    basic_salary = Column(Float)
    hra = Column(Float)
    allowances = Column(Float)
    deductions = Column(Float)
    net_salary = Column(Float)
    month = Column(String(20))
    year = Column(Integer)
    
    employee = relationship("Employee", back_populates="payrolls")

class LetterTemplate(Base):
    __tablename__ = "letter_templates"

    id = Column(Integer, primary_key=True, index=True)
    letter_type = Column(String(50), unique=True) # e.g. "Offer", "Appraisal"
    template_body = Column(Text) # Stores Jinja2 template string

class GeneratedLetter(Base):
    __tablename__ = "generated_letters"

    id = Column(Integer, primary_key=True, index=True)
    emp_id = Column(Integer, ForeignKey("employees.id"))
    letter_type = Column(String(50))
    content = Column(Text) # Storing the full text
    file_path = Column(String(255), nullable=True)
    generated_on = Column(DateTime, default=datetime.utcnow)
    
    employee = relationship("Employee", back_populates="letters")
