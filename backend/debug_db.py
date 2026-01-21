from app.database import SessionLocal
from app.models import models

def check_db():
    db = SessionLocal()
    try:
        employees = db.query(models.Employee).all()
        print(f"Total Employees in DB: {len(employees)}")
        for e in employees:
            print(f"ID: {e.id}, Name: {e.name}, Email: {e.email}, Joined: {e.joining_date} (Type: {type(e.joining_date)})")
    finally:
        db.close()

if __name__ == "__main__":
    check_db()
