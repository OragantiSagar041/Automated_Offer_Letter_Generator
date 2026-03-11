import pytest
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from conftest import mock_db
from bson import ObjectId

def test_health_check(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"

def test_health_check_alias(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["message"] == "API is live"

def test_not_found_route(client):
    response = client.get("/invalid-route-1234")
    assert response.status_code == 404

def test_invalid_method(client):
    response = client.post("/")
    assert response.status_code == 405
