import jsPDF from 'jspdf';

export const generatePDFDoc = async (generatedContent, logoUrl = '/arah_logo.jpg') => {
    const doc = new jsPDF();

    // 1. Add Logo
    try {
        const img = new Image();
        img.src = logoUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => resolve(); // Ignore error
        });
        doc.addImage(img, 'JPEG', 15, 10, 40, 40);
    } catch (e) {
        console.error("Logo Error:", e);
    }

    // 2. Add Content with Multi-Page Support
    const splitText = doc.splitTextToSize(generatedContent, 180);
    const pageHeight = doc.internal.pageSize.height;
    const marginY = 20;
    let cursorY = 60; // Start Y position (after Logo)

    doc.setFontSize(12);
    doc.setFont("courier", "normal"); // Monospace

    splitText.forEach(line => {
        if (cursorY > pageHeight - marginY) {
            doc.addPage();
            cursorY = 20;
        }
        doc.text(line, 15, cursorY);
        cursorY += 7;
    });

    return doc;
};
