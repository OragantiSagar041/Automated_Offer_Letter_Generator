import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db
from bson import ObjectId
from datetime import datetime, timedelta, timezone
import uuid
from unittest.mock import MagicMock
import traceback
import sys
import os

# Ensure backend directory is in the path
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))

# --- SETUP ---
client = TestClient(app)

STATUSES = ["Offer Sent", "Accepted", "Rejected", "Pending", None]
EXPIRATION_TYPES = [
    "past_aware", "future_aware", "past_naive", "future_naive", "past_string", "future_string", "none"
]

def get_expires_at(exp_type, now_aware):
    if exp_type == "past_aware": return now_aware - timedelta(hours=1)
    if exp_type == "future_aware": return now_aware + timedelta(hours=23)
    if exp_type == "past_naive": return (datetime.now() - timedelta(hours=1)) # Naive
    if exp_type == "future_naive": return (datetime.now() + timedelta(hours=23)) # Naive
    if exp_type == "past_string": return (now_aware - timedelta(hours=1)).isoformat()
    if exp_type == "future_string": return (now_aware + timedelta(hours=10)).isoformat()
    return None

def test_offer_response_stress_10000():
    """Stress test with 10,000 permutations."""
    now_aware = datetime.now(timezone.utc)
    
    # Track results
    success_count = 0
    
    for i in range(10000): # Do 10,000 iterations to be absolutely sure.
        # Determine scenario
        token_exists = (i % 3 != 0)
        emp_exists = (i % 4 != 0) if token_exists else False
        status = STATUSES[i % len(STATUSES)]
        exp_type = EXPIRATION_TYPES[i % len(EXPIRATION_TYPES)]
        
        token = str(uuid.uuid4())
        emp_id = str(ObjectId())
        
        db_mock = MagicMock()
        
        # Define mock behavior for collections
        if token_exists:
            db_mock.offer_tokens.find_one.return_value = {
                "token": token,
                "employee_id": emp_id,
                "company_name": "Co"
            }
        else:
            db_mock.offer_tokens.find_one.return_value = None
            
        if emp_exists:
            db_mock.employees.find_one.return_value = {
                "_id": ObjectId(emp_id),
                "name": "Candidate",
                "status": status,
                "expires_at": get_expires_at(exp_type, now_aware)
            }
        else:
            db_mock.employees.find_one.return_value = None
            
        # Overriding the dependency in the app instance
        app.dependency_overrides[get_db] = lambda: db_mock
        
        try:
            response = client.get(f"/offer/accept?token={token}")
            
            # Print failure info if it's a 500 error
            if response.status_code == 500:
                print(f"FAILED Iter {i}: status={status}, exp_type={exp_type}, token_exists={token_exists}, emp_exists={emp_exists}")
                print(response.text)
                sys.exit(1)
                
            success_count += 1
        except Exception as e:
            print(f"CRASHED Iter {i}: status={status}, exp_type={exp_type}, token_exists={token_exists}, emp_exists={emp_exists}")
            traceback.print_exc()
            sys.exit(1)
        finally:
            app.dependency_overrides.clear()
            
    print(f"Verified {success_count} scenarios successfully.")

if __name__ == "__main__":
    test_offer_response_stress_10000()
