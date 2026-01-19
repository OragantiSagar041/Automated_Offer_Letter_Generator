from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .models import models
from .routes import employee, letter, email

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Auto Office Letter Generator")

# Configure CORS so the React Frontend can communicate with this Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employee.router)
app.include_router(letter.router)
app.include_router(email.router)



@app.get("/")
def home():
    return {"status": "running", "message": "Welcome to the Auto Office Letter Generator API"}
# Touch to reload
