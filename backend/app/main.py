from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from .routes import employee, letter, email, upload
from fastapi.staticfiles import StaticFiles
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Auto Office Letter Generator")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation Error: {exc.errors()}")
    body = await request.body()
    logger.error(f"Request Body: {body.decode()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": body.decode()},
    )

# Configure CORS - Nuclear option for testing: Allow everything
# Note: allow_origins=["*"] requires allow_credentials=False in FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(employee.router)
app.include_router(letter.router)
app.include_router(email.router)
app.include_router(upload.router)

# Ensure public dir exists for static files
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "public")
if not os.path.exists(PUBLIC_DIR):
    os.makedirs(PUBLIC_DIR)

app.mount("/", StaticFiles(directory=PUBLIC_DIR), name="public")

@app.get("/health")
def health():
    return {"status": "running", "message": "Welcome to the Auto Office Letter Generator API (MongoDB)"}
