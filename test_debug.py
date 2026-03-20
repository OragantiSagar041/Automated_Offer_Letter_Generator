from fastapi.testclient import TestClient
import sys
import os

# Ensure backend directory is in the path
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))

from app.main import app

client = TestClient(app)

def test_routes():
    # List all routes in the app to see if they are registered correctly
    for route in app.routes:
        print(f"Route: {route.path}")

    # Test the health check first
    response = client.get("/health")
    print(f"Health Response: {response.status_code} - {response.text}")

    # Test a dummy offer accept
    response = client.get("/offer/accept?token=dummy")
    print(f"Offer Response: {response.status_code} - {response.text}")

if __name__ == "__main__":
    test_routes()
