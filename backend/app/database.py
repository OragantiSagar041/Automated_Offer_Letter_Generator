from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from Env
MONGO_URL = os.getenv("MANGO_DB_URL") 

# Create MongoDB Client
client = MongoClient(MONGO_URL)

# Database Name (AutoOfferLetterDB)
db = client.AutoOfferLetterDB

# Dependency
def get_db():
    try:
        yield db
    finally:
        pass 
