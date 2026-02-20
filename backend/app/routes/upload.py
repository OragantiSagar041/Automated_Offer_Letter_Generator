from fastapi import APIRouter, File, UploadFile, HTTPException, Request
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

import fitz # PyMuPDF

@router.post("/template-image")
async def upload_template_image(request: Request, file: UploadFile = File(...)):
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

        file_path = PUBLIC_DIR / file.filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        base_url = str(request.base_url).rstrip("/")
        return {"filename": file.filename, "path": str(file_path), "status": "success", "url": f"{base_url}/{file.filename}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/template-pdf")
async def upload_template_pdf(request: Request, file: UploadFile = File(...)):
    """
    Uploads a PDF, converts the first page to a high-quality JPG, and saves it to public folder.
    Returns the URL of the generated image.
    """
    try:
        if not file.content_type == "application/pdf":
            raise HTTPException(status_code=400, detail="File must be a PDF")

        if not os.path.exists(PUBLIC_DIR):
             raise HTTPException(status_code=500, detail=f"Public directory not found at {PUBLIC_DIR}")

        # 1. Save PDF Temporarily
        temp_pdf_path = PUBLIC_DIR / f"temp_{file.filename}"
        with open(temp_pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. Convert to Image
        doc = fitz.open(temp_pdf_path)
        page = doc.load_page(0) # First page
        pix = page.get_pixmap(dpi=300) # High Quality
        
        # 3. Save Image
        image_filename = f"{file.filename}.jpg"
        image_path = PUBLIC_DIR / image_filename
        pix.save(image_path)
        
        doc.close()
        
        # 4. Cleanup Temp PDF
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)
            
        base_url = str(request.base_url).rstrip("/")
        return {"filename": image_filename, "url": f"{base_url}/{image_filename}", "status": "success"}

    except Exception as e:
        print(f"Error converting PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))
