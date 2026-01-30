import fitz  # PyMuPDF
import os

# Paths
base_dir = os.path.dirname(os.path.abspath(__file__))
public_dir = os.path.join(base_dir, '..', 'public')
pdf_path = os.path.join(public_dir, 'Zero7_A4.pdf')
jpg_path = os.path.join(public_dir, 'Zero7_A4.jpg')

print(f"Looking for PDF at: {pdf_path}")

try:
    if not os.path.exists(pdf_path):
        print("Error: PDF file not found!")
        exit(1)

    doc = fitz.open(pdf_path)
    page = doc.load_page(0)  # Get first page
    pix = page.get_pixmap(dpi=150) # 150 DPI is good balance for web/pdf
    pix.save(jpg_path)
    
    print(f"BINGO! Successfully converted PDF to Image: {jpg_path}")
    print("You can now refresh the browser.")

except Exception as e:
    print(f"Conversion failed: {e}")
