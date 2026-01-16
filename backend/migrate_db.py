from sqlalchemy import create_engine, text

SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)

def run_migration():
    print("Migrating Database...")
    with engine.connect() as conn:
        try:
            # Check if column exists, if not add it
            # SQLite doesn't have IF NOT EXISTS for columns, easy way is just try/catch
            conn.execute(text("ALTER TABLE generated_letters ADD COLUMN content TEXT"))
            print("Successfully added 'content' column.")
        except Exception as e:
            if "duplicate column name" in str(e):
                print("'content' column already exists.")
            else:
                print(f"Error: {e}")
                
        # Also fix file_path nullable if needed, but SQLite is loose on this
    print("Migration Complete.")

if __name__ == "__main__":
    run_migration()
