from sqlalchemy import create_engine, text

SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)

def run_migration():
    print("Migrating Employee Status...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE employees ADD COLUMN status VARCHAR(50) DEFAULT 'Pending'"))
            print("Successfully added 'status' column.")
        except Exception as e:
            if "duplicate column name" in str(e):
                print("'status' column already exists.")
            else:
                print(f"Error: {e}")
    print("Migration Complete.")

if __name__ == "__main__":
    run_migration()
