import sys
import os
import io
import pandas as pd
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))
from conftest import mock_db
from bson import ObjectId

# --- CREATE COMPANIES ---
def test_create_company_success(client):
    payload = {
        "emp_id": "COM01",
        "name": "Big Corp",
        "email": "contact@bigcorp.com",
        "designation": "Director",
        "joining_date": "2024-02-01",
        "percentage": 10.5,
        "address": "123 Business St",
        "replacement": "90",
        "invoice_post_joining": "30",
        "payment_release": "15",
        "signature": "John Doe - CEO"
    }
    res = client.post("/agreement-companies/", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Big Corp"
    assert "id" in data
    assert data["compensation"]["percentage"] == 10.5

def test_create_company_missing_fields(client):
    payload = {
        "name": "Small Corp",
        "email": "contact@smallcorp.com"
        # missing percentage
    }
    res = client.post("/agreement-companies/", json=payload)
    assert res.status_code == 422 

# --- READ COMPANIES ---
def test_get_companies_empty(client):
    mock_db.companies.delete_many({})
    res = client.get("/agreement-companies/")
    assert res.status_code == 200
    assert len(res.json()) == 0

def test_get_companies_skip_limit(client):
    mock_db.companies.delete_many({})
    for i in range(5):
        mock_db.companies.insert_one({"email": f"com{i}@test.com", "name": f"Company {i}"})
    res = client.get("/agreement-companies/?skip=2&limit=2")
    assert res.status_code == 200
    assert len(res.json()) == 2

def test_get_company_by_id_success(client):
    res_insert = mock_db.companies.insert_one({"email": "findco@test.com", "name": "Find Co"})
    co_id = str(res_insert.inserted_id)
    
    res = client.get(f"/agreement-companies/{co_id}")
    assert res.status_code == 200
    assert res.json()["name"] == "Find Co"

def test_get_company_by_id_not_found(client):
    res = client.get(f"/agreement-companies/{str(ObjectId())}")
    assert res.status_code == 404

def test_get_company_by_id_invalid(client):
    res = client.get("/agreement-companies/invalid_id")
    assert res.status_code == 400

# --- UPDATE COMPANIES ---
def test_update_company_success(client):
    res_insert = mock_db.companies.insert_one({"email": "updco@test.com", "name": "Old Co"})
    co_id = str(res_insert.inserted_id)
    
    payload = {
        "name": "New Co",
        "percentage": 15.0
    }
    res = client.put(f"/agreement-companies/{co_id}", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "New Co"
    assert data["compensation"]["percentage"] == 15.0

def test_update_company_not_found(client):
    payload = {"percentage": 1.0}
    res = client.put(f"/agreement-companies/{str(ObjectId())}", json=payload)
    assert res.status_code == 404

def test_update_company_invalid_id(client):
    res = client.put("/agreement-companies/invalid_id", json={"percentage": 1.0})
    assert res.status_code == 400

# --- DELETE COMPANIES ---
def test_delete_company_success(client):
    res_insert = mock_db.companies.insert_one({"email": "delco@test.com"})
    co_id = str(res_insert.inserted_id)
    
    res = client.delete(f"/agreement-companies/{co_id}")
    assert res.status_code == 204
    assert mock_db.companies.find_one({"_id": ObjectId(co_id)}) is None

def test_delete_company_not_found(client):
    res = client.delete(f"/agreement-companies/{str(ObjectId())}")
    assert res.status_code == 404

def test_delete_company_invalid_id(client):
    res = client.delete("/agreement-companies/invalid_id")
    assert res.status_code == 400

# --- TEMPLATE & UPLOAD ---
def test_download_company_template(client):
    res = client.get("/agreement-companies/template")
    assert res.status_code == 200
    assert "Company_Import_Template.xlsx" in res.headers["content-disposition"]

def test_upload_companies_csv(client):
    csv_content = "Company Name,Email Contact,Compensation %,Replacement Period (Days),Payment Release (Days)\nBulk Corp,bulkc@test.com,12.5,90,30"
    files = {"file": ("comp.csv", csv_content, "text/csv")}
    res = client.post("/agreement-companies/upload", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["imported_count"] >= 1
    
    co = mock_db.companies.find_one({"email": "bulkc@test.com"})
    assert co is not None
    assert co["name"] == "Bulk Corp"
    assert co["compensation"]["percentage"] == 12.5

def test_upload_companies_duplicate_email(client):
    mock_db.companies.insert_one({"email": "dupc@test.com"})
    csv_content = "Company Name,Email Contact\nDup Co,dupc@test.com\n"
    files = {"file": ("dup.csv", csv_content, "text/csv")}
    res = client.post("/agreement-companies/upload", files=files)
    assert res.status_code == 200
    assert res.json()["imported_count"] == 0
    assert "Exists" in res.json()["errors"][0]
