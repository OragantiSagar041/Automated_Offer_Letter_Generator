// import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Generates a PDF by writing text ON TOP of an existing PDF template.
 * @param {string} textContent - The letter content (text with \n).
 * @param {string} templateUrl - URL to the PDF template (e.g. '/Arah_Template.pdf').
 * @returns {Promise<string>} - Base64 Data URI of the final PDF.
 */
export const generatePdfWithTemplate = async (htmlContent, templateUrl = '/Arah_Template.pdf') => {
    try {
        const { PDFDocument } = await import('pdf-lib');
        const { jsPDF } = await import('jspdf');

        // Layout Strategy:
        // Full Time (Dense): Compress text to fit 1 page.
        // Intern (Sparse): Expand text to fill 1 page cleanly.
        // Dense Detection: Check for Salary Table or Length
        const isDense = htmlContent.length > 2500 || htmlContent.includes("REMUNERATION") || htmlContent.includes("Annexure A");

        const config = isDense ? {
            // FULL TIME: Unified Width Strategy
            fontSize: '11px',
            lineHeight: '1.3',
            pMargin: '8px',
            hMargin: '12px',
            tableSize: '11px',
            padding: '40px 50px',
            yStart: 85,
            scale: 0.70, // Standardized for 790px width
            minHeight: '940px', // Vertically fills the page
            display: 'flex',
            flexDirection: 'column'
        } : {
            // INTERN: Unified Width Strategy
            fontSize: '16px',
            lineHeight: '1.8',
            pMargin: '15px',
            hMargin: '25px',
            tableSize: '14px',
            padding: '50px 60px',
            yStart: 130,
            scale: 0.70, // Standardized for 790px width
            minHeight: '900px', // Vertically fills the page
            display: 'flex',
            flexDirection: 'column'
        };

        // 1. Generate Content PDF from HTML using jsPDF
        // We use a temporary container to render the HTML
        const container = document.createElement('div');

        // CSS to fix alignment and prevent weird breaks
        const style = document.createElement('style');
        style.innerHTML = `
            * { font-family: Helvetica, Arial, sans-serif !important; }
            p { margin-bottom: ${config.pMargin} !important; }
            h3 { margin-top: ${config.hMargin} !important; margin-bottom: 5px !important; font-size: ${parseInt(config.fontSize) + 2}px !important; }
            .date-row { display: flex; justify-content: flex-end; align-items: center; margin-bottom: ${isDense ? '5px' : '20px'} !important; }
            .signature-block { page-break-inside: avoid; margin-top: auto; } /* 'auto' pushes to bottom in flex container */
            /* Compact Table */
            table { margin-top: 5px !important; width: 100% !important; font-size: ${config.tableSize} !important; }
            td, th { padding: ${isDense ? '3px' : '8px'} !important; }
        `;
        container.appendChild(style);

        container.style.position = 'fixed'; // 'absolute' might scroll away, 'fixed' is safer for capture
        container.style.left = '0';
        container.style.top = '0'; // Must be in viewport for html2canvas to spy on it
        container.style.zIndex = '-9999'; // Hide behind everything
        container.style.width = '790px'; // Much wider to fill the page (PDF A4 Width @ 96dpi is ~794px)
        container.style.background = 'transparent'; // Ensure background is transparent
        container.style.fontSize = config.fontSize;
        container.style.lineHeight = config.lineHeight;


        // Flexbox logic for ALL modes to stretch content
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.minHeight = config.minHeight;

        // Add padding to simulate margins of the final document
        container.style.padding = config.padding;
        container.innerHTML = htmlContent;
        document.body.appendChild(container);

        const contentPdfDoc = new jsPDF({
            unit: 'pt',
            format: 'a4'
        });

        // Use .html() to render the container to the PDF
        // note: margin logic here helps position the text below the Template Header
        await new Promise((resolve) => {
            contentPdfDoc.html(container, {
                callback: resolve,
                x: 0,
                y: config.yStart, // Moved up to use more vertical space
                width: 790, // Match container width
                windowWidth: 790, // Match container width
                autoPaging: 'text', // Try to avoid cutting text
                margin: [0, 0, 40, 0], // Bottom margin
                html2canvas: {
                    scale: config.scale, // Scaled down to fit content on one page
                    backgroundColor: null, // Transparent background
                    logging: false
                }
            });
        });

        document.body.removeChild(container);
        const contentPdfBytes = contentPdfDoc.output('arraybuffer');

        // 2. Load Template PDF
        const templatePdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
        const templateDoc = await PDFDocument.load(templatePdfBytes);

        // 3. Load Content PDF
        const contentDoc = await PDFDocument.load(contentPdfBytes);

        // 4. Create Final PDF
        const finalDoc = await PDFDocument.create();

        const contentPages = contentDoc.getPages();

        for (let i = 0; i < contentPages.length; i++) {
            // Copy Template Page (Background) - Always use Page 1 of template
            const [templatePage] = await finalDoc.copyPages(templateDoc, [0]);
            const finalPage = finalDoc.addPage(templatePage); // This adds the template as the base

            // Copy Content Page (Foreground)
            const [contentPage] = await finalDoc.copyPages(contentDoc, [i]);

            // Embed the Content Page onto the Template Page
            // We need to embed it to draw it on top
            const embeddedPage = await finalDoc.embedPage(contentPage);

            finalPage.drawPage(embeddedPage, {
                x: 0,
                y: 0,
                width: finalPage.getWidth(),
                height: finalPage.getHeight(),
                opacity: 1, // Ensure content is visible
                blendMode: 'Multiply' // Try to make white background transparent?
            });
            // Note: Standard PDF pages have white backgrounds. 
            // Embedding a white-background page on top of the template will cover the template.
            // We need to rely on 'Multiply' blend mode to make the white transparent!
        }

        const pdfBytes = await finalDoc.save();
        const bytes = new Uint8Array(pdfBytes);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return 'data:application/pdf;base64,' + window.btoa(binary);

    } catch (err) {
        console.error("PDF Template Error:", err);
        throw err;
    }
};
