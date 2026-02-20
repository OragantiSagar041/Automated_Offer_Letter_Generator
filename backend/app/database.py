from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from Env
MONGO_URL = os.getenv("MANGO_DB_URL") 

# Create MongoDB Client with timeout and TLS settings for robust cloud connectivity
client = MongoClient(
    MONGO_URL,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000,
    tls=True
)

db = client.AutoOfferLetterDB

# Dependency
def get_db():
    try:
        yield db
    finally:
        pass 
