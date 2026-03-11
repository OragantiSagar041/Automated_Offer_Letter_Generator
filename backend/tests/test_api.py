import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from conftest import mock_db
from bson import ObjectId

def test_health_check(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"
    assert response.json()["message"] == "API is live"

def test_create_employee(client):
    payload = {
        "emp_id": "EMP001",
        "name": "Jane Test",
        "email": "jane@test.com",
        "designation": "Software Engineer",
        "department": "Engineering",
        "joining_date": "2024-01-01",
        "location": "Remote",
        "employment_type": "Full Time",
        "ctc": 1000000,
        "basic_salary": 400000,
        "pt": 2400,
        "pf": 48000
    }
    
    response = client.post("/employees/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Jane Test"
    assert "id" in data
    
    # Check DB
    emp_db = mock_db.employees.find_one({"_id": ObjectId(data["id"])})
    assert emp_db is not None
    assert emp_db["email"] == "jane@test.com"

def test_get_employees(client):
    mock_db.employees.delete_many({})
    mock_db.employees.insert_one({"name": "Fake Employee", "email": "fake@test.com", "status": "Pending"})
    
    response = client.get("/employees/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Fake Employee"

def test_download_employee_template(client):
    response = client.get("/employees/template")
    assert response.status_code == 200
    assert "attachment; filename=Employee_Import_Template.xlsx" in response.headers["content-disposition"]
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
