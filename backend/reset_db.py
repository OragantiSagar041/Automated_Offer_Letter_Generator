from sqlalchemy import create_engine
from app.database import Base
from app.models import models

SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)

def reset_db():
    print("Resetting Database...")
    # Drop all tables
    Base.metadata.drop_all(bind=engine)
    print("All tables dropped.")
    
    # Recreate tables
    Base.metadata.create_all(bind=engine)
    print("All tables recreated. Database is clean.")

if __name__ == "__main__":
    reset_db()
