import sys
import os
import io
import pandas as pd
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
from conftest import mock_db
from bson import ObjectId

# --- CREATE EMPLOYEES ---
def test_create_employee_success(client):
    payload = {
        "emp_id": "EMP010",
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
    res = client.post("/employees/", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Jane Test"
    assert "id" in data
    assert data["compensation"]["ctc"] == 1000000

def test_create_employee_missing_ctc(client):
    payload = {
        "name": "Jane Test",
        "email": "jane@test.com",
        "basic_salary": 400000
    }
    res = client.post("/employees/", json=payload)
    assert res.status_code == 422 # missing ctc

def test_create_employee_auto_calculate_pt_pf(client):
    payload = {
        "email": "auto@test.com",
        "name": "Auto Calc",
        "ctc": 1200000,
        "basic_salary": 480000
    }
    res = client.post("/employees/", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["compensation"]["pf"] == 57600.0 # 480000 * 0.12

# --- READ EMPLOYEES ---
def test_get_employees_empty(client):
    mock_db.employees.delete_many({})
    res = client.get("/employees/")
    assert res.status_code == 200
    assert len(res.json()) == 0

def test_get_employees_skip_limit(client):
    mock_db.employees.delete_many({})
    for i in range(5):
        mock_db.employees.insert_one({"email": f"test{i}@test.com", "status": "Pending"})
    res = client.get("/employees/?skip=1&limit=2")
    assert res.status_code == 200
    assert len(res.json()) == 2

def test_get_employee_by_id_success(client):
    res_insert = mock_db.employees.insert_one({"email": "findme@test.com", "name": "Find Me", "status": "Pending"})
    emp_id = str(res_insert.inserted_id)
    
    res = client.get(f"/employees/{emp_id}")
    assert res.status_code == 200
    assert res.json()["name"] == "Find Me"

def test_get_employee_by_id_not_found(client):
    fake_id = str(ObjectId())
    res = client.get(f"/employees/{fake_id}")
    assert res.status_code == 404

def test_get_employee_by_id_invalid(client):
    res = client.get("/employees/invalid_id")
    assert res.status_code == 400

# --- UPDATE EMPLOYEES ---
def test_update_employee_success(client):
    res_insert = mock_db.employees.insert_one({"email": "upd@test.com", "name": "Old Name", "compensation": {"ctc": 500000}})
    emp_id = str(res_insert.inserted_id)
    
    payload = {
        "name": "New Name",
        "email": "upd@test.com",
        "ctc": 600000,
        "basic_salary": 240000
    }
    res = client.put(f"/employees/{emp_id}", json=payload)
    assert res.status_code == 200
    assert res.json()["name"] == "New Name"
    assert res.json()["compensation"]["ctc"] == 600000

def test_update_employee_not_found(client):
    fake_id = str(ObjectId())
    payload = {"email": "x@x.com", "ctc": 1, "basic_salary": 1}
    res = client.put(f"/employees/{fake_id}", json=payload)
    assert res.status_code == 404

def test_update_employee_invalid_id(client):
    payload = {"email": "x@x.com", "ctc": 1, "basic_salary": 1}
    res = client.put("/employees/invalid_id", json=payload)
    assert res.status_code == 400

# --- DELETE EMPLOYEES ---
def test_delete_employee_success(client):
    res_insert = mock_db.employees.insert_one({"email": "del@test.com"})
    emp_id = str(res_insert.inserted_id)
    
    res = client.delete(f"/employees/{emp_id}")
    assert res.status_code == 204
    assert mock_db.employees.find_one({"_id": ObjectId(emp_id)}) is None

def test_delete_employee_not_found(client):
    fake_id = str(ObjectId())
    res = client.delete(f"/employees/{fake_id}")
    assert res.status_code == 404

def test_delete_employee_invalid_id(client):
    res = client.delete("/employees/invalid_id")
    assert res.status_code == 400

# --- TEMPLATE & UPLOAD ---
def test_download_employee_template(client):
    res = client.get("/employees/template")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

def test_upload_employees_csv(client):
    csv_content = "Employee ID,Full Name,Email Address,Joining Date,Designation,Department,Employment Type,Location,Annual CTC (\u20b9),Basic Salary (Monthly) (\u20b9),PT (Monthly) (\u20b9),PF (Monthly) (\u20b9)\nEMP999,Bulk Test,bulk@test.com,2024-05-01,Dev,IT,Full Time,Remote,500000,0,0,0"
    files = {"file": ("test.csv", csv_content, "text/csv")}
    res = client.post("/employees/upload", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["imported_count"] >= 1
    
    emp = mock_db.employees.find_one({"email": "bulk@test.com"})
    assert emp is not None
    assert emp["name"] == "Bulk Test"

def test_upload_employees_invalid_format(client):
    files = {"file": ("test.txt", b"some text", "text/plain")}
    res = client.post("/employees/upload", files=files)
    assert res.status_code == 500

def test_upload_employees_missing_email(client):
    csv_content = "Employee ID,Full Name,Email Address\nEMP999,Bulk Test,\n"
    files = {"file": ("err.csv", csv_content, "text/csv")}
    res = client.post("/employees/upload", files=files)
    assert res.status_code == 200
    assert len(res.json()["errors"]) > 0

def test_upload_employees_duplicate_email(client):
    mock_db.employees.insert_one({"email": "dup@test.com"})
    csv_content = "Employee ID,Full Name,Email Address\nEMP999,Dup Test,dup@test.com\n"
    files = {"file": ("dup.csv", csv_content, "text/csv")}
    res = client.post("/employees/upload", files=files)
    assert res.status_code == 200
    assert res.json()["imported_count"] == 0
    assert "Exists" in res.json()["errors"][0]
