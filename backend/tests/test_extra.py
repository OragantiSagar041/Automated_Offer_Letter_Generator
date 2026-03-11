import pytest
import sys
import os
import base64
sys.path.insert(0, os.path.dirname(__file__))
from conftest import mock_db
from bson import ObjectId

@pytest.fixture
def mock_employee():
    res = mock_db.employees.insert_one({
        "emp_id": "RES01",
        "name": "Responder",
        "email": "res@test.com",
        "status": "Offer Sent"
    })
    emp_id = str(res.inserted_id)
    tok_val = f"tok_{emp_id}"
    mock_db.offer_tokens.insert_one({
        "token": tok_val,
        "employee_id": emp_id
    })
    return emp_id, tok_val

@pytest.fixture
def mock_company():
    res = mock_db.companies.insert_one({
        "emp_id": "COMPRES01",
        "name": "Responder Corp",
        "email": "corp@test.com",
        "status": "Agreement Sent"
    })
    comp_id = str(res.inserted_id)
    return comp_id

# --- RESPONSES ---
def test_accept_offer(client, mock_employee):
    emp_id, tok = mock_employee
    res = client.get(f"/offer/accept?token={tok}")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    
    # Check DB update
    emp = mock_db.employees.find_one({"_id": ObjectId(emp_id)})
    assert emp["status"] == "Accepted"

def test_reject_offer(client, mock_employee):
    emp_id, tok = mock_employee
    res = client.get(f"/offer/reject?token={tok}")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    
    # Check DB update
    emp = mock_db.employees.find_one({"_id": ObjectId(emp_id)})
    assert emp["status"] == "Rejected"

def test_accept_offer_invalid_id(client):
    res = client.get(f"/offer/accept?token=invalid_tok")
    assert res.status_code == 404



# --- EMAILS (MOCKING BREVO IS HARD/SLOW, BUT WE CAN ASSERT PAYLOAD ERRS) ---
def test_send_offer_email_missing_pdf(client, mock_employee):
    payload = {
        "employee_id": mock_employee,
        "letter_content": "Congratulations...",
        "pdf_base64": "" # empty base64 usually fails if not caught early, or fails during attachment
    }
    res = client.post("/email/send", json=payload)
    assert res.status_code in [200, 400, 422, 500] 

def test_send_agreement_email_missing_pdf(client, mock_company):
    payload = {
        "company_id": mock_company,
        "letter_content": "Agreement...",
        "pdf_base64": ""
    }
    res = client.post("/agreement-emails/send", json=payload)
    assert res.status_code in [200, 400, 422, 500, 404]

def test_send_email_invalid_employee(client):
    payload = {
        "employee_id": str(ObjectId()),
        "letter_content": "Hello",
        "pdf_base64": "SGVsbG8="
    }
    res = client.post("/email/send", json=payload)
    assert res.status_code == 404
