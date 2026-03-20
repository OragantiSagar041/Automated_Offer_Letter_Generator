import pytest
from fastapi.testclient import TestClient
from app.main import app
from bson import ObjectId
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, timezone
import uuid
import itertools

client = TestClient(app)

# --- SCENARIOS ---
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

@pytest.fixture
def mock_db():
    with patch("app.database.get_db") as mock:
        db = MagicMock()
        mock.return_value = db
        yield db

def test_offer_response_stress_10000(mock_db):
    """
    Stress test for offer response logic across 10,000 permutations.
    This ensures that various combinations of database state and 
    datetime formats never crash the server.
    """
    now_aware = datetime.now(timezone.utc)
    
    # We will run 10,000 simulated iterations
    errors = []
    
    for i in range(10000):
        # Pick a combination
        token_exists = (i % 3 != 0) # Token exists in 66% of cases
        emp_exists = (i % 4 != 0) if token_exists else False # Emp exists in 75% of those cases
        status = STATUSES[i % len(STATUSES)]
        exp_type = EXPIRATION_TYPES[i % len(EXPIRATION_TYPES)]
        
        token = str(uuid.uuid4())
        emp_id = str(ObjectId())
        
        # MOCK SETUP
        if token_exists:
            mock_db.offer_tokens.find_one.return_value = {
                "token": token,
                "employee_id": emp_id,
                "company_name": "Test Stress Corp"
            }
        else:
            mock_db.offer_tokens.find_one.return_value = None
            
        if emp_exists:
            mock_db.employees.find_one.return_value = {
                "_id": ObjectId(emp_id),
                "name": f"Stress Candidate {i}",
                "status": status,
                "expires_at": get_expires_at(exp_type, now_aware)
            }
        else:
            mock_db.employees.find_one.return_value = None
            
        # EXECUTE
        try:
            # We don't want the update_one to actually hit a DB, 
            # and the MagicMock handles it.
            
            response = client.get(f"/offer/accept?token={token}")
            
            # VALIDATION
            if not token_exists or not emp_exists:
                assert response.status_code == 404
                assert "Invalid" in response.text
            elif status in ["Accepted", "Rejected"]:
                assert response.status_code == 200
                assert "Already Responded" in response.text
            elif exp_type in ["past_aware", "past_naive", "past_string"]:
                assert response.status_code == 200
                assert "Invalid" in response.text 
            else:
                assert response.status_code == 200
                assert "Accepted!" in response.text
                
        except Exception as e:
            errors.append(f"Case {i} failed: {str(e)} | Token: {token_exists}, Emp: {emp_exists}, Status: {status}, Exp: {exp_type}")
            if len(errors) > 5: break # Cap error reports
            
    if errors:
        pytest.fail(f"Stress test encountered {len(errors)} errors: \n" + "\n".join(errors))
    else:
        print(f"Successfully completed 10,000 test scenarios for offer response.")

def test_reject_simple_coverage(mock_db):
    """Quick check for reject route to ensure logic parity."""
    token = "test-token"
    emp_id = str(ObjectId())
    now_aware = datetime.now(timezone.utc)
    
    mock_db.offer_tokens.find_one.return_value = {"token": token, "employee_id": emp_id, "company_name": "Co"}
    mock_db.employees.find_one.return_value = {
        "_id": ObjectId(emp_id), "name": "N", "status": "Offer Sent", 
        "expires_at": now_aware + timedelta(hours=10)
    }
    
    response = client.get(f"/offer/reject?token={token}")
    assert response.status_code == 200
    assert "Declined" in response.text
