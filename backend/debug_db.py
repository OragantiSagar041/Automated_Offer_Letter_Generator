from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Connect to the SQLite Database
SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def inspect_db():
    db = SessionLocal()
    try:
        print("\n=== 1. EMPLOYEES TABLE ===")
        employees = db.execute(text("SELECT * FROM employees")).fetchall()
        if not employees:
            print("No employees found.")
        for emp in employees:
            print(emp)

        print("\n=== 2. PAYROLL TABLE ===")
        payrolls = db.execute(text("SELECT * FROM payrolls")).fetchall()
        if not payrolls:
            print("No payroll records found.")
        for p in payrolls:
            # Format: id, emp_id, basic, hra, allowances, deductions, net_salary, month, year
            print(p)

        print("\n=== 3. LETTER TEMPLATES TABLE ===")
        templates = db.execute(text("SELECT * FROM letter_templates")).fetchall()
        if not templates:
            print("No templates found.")
        for t in templates:
            print(t)

        print("\n=== 4. GENERATED LETTERS TABLE ===")
        letters = db.execute(text("SELECT * FROM generated_letters")).fetchall()
        if not letters:
            print("No generated letter history found (As expected).")
        for l in letters:
            print(l)

    except Exception as e:
        print(f"Error inspecting DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect_db()
