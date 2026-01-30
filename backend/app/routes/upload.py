from fastapi import APIRouter, File, UploadFile, HTTPException
import shutil
import os
from pathlib import Path

router = APIRouter(
    prefix="/upload",
    tags=["Upload"]
)

# Relative path to the frontend public folder from this backend file
# backend/app/routes/upload.py -> backend/app/routes -> backend/app -> backend -> ROOT -> public
# So it is ../../../public
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
PUBLIC_DIR = BASE_DIR / "public"

@router.post("/template-image")
async def upload_template_image(file: UploadFile = File(...)):
    """
    Uploads a JPG/PNG template image directly to the frontend's public folder.
    """
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image (JPG/PNG)")

        # Ensure public directory exists
        if not os.path.exists(PUBLIC_DIR):
             raise HTTPException(status_code=500, detail=f"Public directory not found at {PUBLIC_DIR}")

        # Force filename to be safe or use specific names? 
        # For now let's allow saving as the provided filename, but user requested Zero7_A4.jpg specifically.
        # Let's save it exactly as uploaded.
        
        file_path = PUBLIC_DIR / file.filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"filename": file.filename, "path": str(file_path), "status": "success"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
