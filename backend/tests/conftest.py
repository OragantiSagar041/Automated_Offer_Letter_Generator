import pytest
from fastapi.testclient import TestClient
from mongomock import MongoClient

from app.main import app
from app.database import get_db

# Create a mongomock client
mock_client = MongoClient()
mock_db = mock_client.TestOfferLetterDB

# Override the database dependency to yield the mongomock db
def override_get_db():
    try:
        yield mock_db
    finally:
        pass

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session")
def test_app():
    return app

@pytest.fixture(scope="session")
def client(test_app):
    return TestClient(test_app)

@pytest.fixture(autouse=True)
def clean_db():
    """Clear mongomock collections before each test"""
    # clear all collections instead of dropping db, mongomock handles drop_collection safely
    for col in mock_db.list_collection_names():
        mock_db.drop_collection(col)
