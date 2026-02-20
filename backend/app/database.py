import certifi
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from Env
MONGO_URL = os.getenv("MANGO_DB_URL") 
ca = certifi.where()

# Create MongoDB Client with timeout and SSL/TLS settings using certifi
client = MongoClient(
    MONGO_URL,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000,
    tls=True,
    tlsCAFile=ca
)

db = client.AutoOfferLetterDB

# Dependency
def get_db():
    try:
        yield db
    finally:
        pass 
