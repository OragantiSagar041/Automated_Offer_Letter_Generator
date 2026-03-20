import certifi
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from Env
MONGO_URL = os.getenv("MANGO_DB_URL") or os.getenv("MONGO_DB_URL") or os.getenv("DATABASE_URL")
ca = certifi.where()

if not MONGO_URL:
    print("WARNING: No MongoDB URL found in environment variables (MANGO_DB_URL/MONGO_DB_URL/DATABASE_URL)")

# Create MongoDB Client with timeout and SSL/TLS settings using certifi
client = MongoClient(
    MONGO_URL,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000,
    tls=True,
    tlsCAFile=ca,
    tz_aware=True  # Important for consistent datetime comparisons
)

db = client.AutoOfferLetterDB

# Dependency
def get_db():
    try:
        yield db
    finally:
        pass 
