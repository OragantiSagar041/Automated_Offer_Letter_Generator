import sys
import os
import pytest
sys.path.insert(0, os.path.dirname(__file__))
from conftest import mock_db
from bson import ObjectId

# Let's import the specific module or just use the client to hit endpoints
# For letters, we need a valid employee in the mock db.

@pytest.fixture
def mock_employee():
    res = mock_db.employees.insert_one({
        "emp_id": "LTEST01",
        "name": "Letter Tester",
        "email": "letter@test.com",
        "designation": "Analyst",
        "department": "Research",
        "joining_date": "2024-06-01",
        "location": "Bangalore",
        "employment_type": "Full Time",
        "compensation": {
            "ctc": 1200000,
            "basic_salary": 480000,
            "hra": 192000,
            "conveyance": 19200,
            "medical_allowance": 15000,
            "special_allowance": 493800,
            "allowances": 493800,
            "gross_salary": 1200000,
            "pt": 2400,
            "pf": 57600,
            "deductions": 60000,
            "net_salary": 1140000
        }
    })
    return str(res.inserted_id)

@pytest.fixture
def mock_company():
    res = mock_db.companies.insert_one({
        "emp_id": "ACTEST01",
        "name": "Acme Corp",
        "email": "contact@acme.com",
        "designation": "CEO",
        "joining_date": "2024-07-01",
        "address": "456 Corporate Blvd",
        "replacement": "60",
        "invoice_post_joining": "45",
        "payment_release": "15",
        "signature": "Alice - CEO",
        "compensation": {
            "percentage": 8.33
        }
    })
    return str(res.inserted_id)

def test_generate_offer_letter(client, mock_employee):
    payload = {
        "employee_id": mock_employee,
        "letter_type": "Standard Offer Letter",
        "company_name": "Arah Infotech Pvt Ltd"
    }
    
    res = client.post("/letters/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "content" in data
    assert "Letter Tester" in data["content"]
    assert "1,200,000" in data["content"] or "12,00,000" in data["content"] or "1200000" in data["content"]

def test_generate_offer_letter_invalid_employee(client):
    payload = {
        "employee_id": str(ObjectId()),
        "letter_type": "Standard Offer Letter"
    }
    res = client.post("/letters/generate", json=payload)
    assert res.status_code == 404

def test_generate_offer_letter_invalid_id_format(client):
    payload = {
        "employee_id": "bad_id",
        "letter_type": "Standard Offer Letter"
    }
    res = client.post("/letters/generate", json=payload)
    assert res.status_code == 400

def test_generate_agreement_letter(client, mock_company):
    payload = {
        "employee_id": mock_company,
        "letter_type": "Standard Agreement",
        "company_name": "Arah Infotech Pvt Ltd"
    }
    
    res = client.post("/agreement-letters/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "content" in data
    assert "Acme Corp" in data["content"]
    assert "8.33" in data["content"]

def test_generate_agreement_invalid_company(client):
    payload = {
        "employee_id": str(ObjectId()),
        "letter_type": "Standard Agreement"
    }
    res = client.post("/agreement-letters/generate", json=payload)
    assert res.status_code == 404

def test_generate_agreement_invalid_id_format(client):
    payload = {
        "employee_id": "bad_id",
        "letter_type": "Standard Agreement"
    }
    res = client.post("/agreement-letters/generate", json=payload)
    assert res.status_code == 400
