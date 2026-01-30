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

        // 2. Identify Template Type
        const isImage = templateUrl.toLowerCase().endsWith('.jpg') ||
            templateUrl.toLowerCase().endsWith('.jpeg') ||
            templateUrl.toLowerCase().endsWith('.png');

        if (isImage) {
            // --- IMAGE STRATEGY (Best for robustness) ---
            console.log("Using Image Template Strategy");
            const finalDoc = await PDFDocument.create();
            const imgRes = await fetch(`${templateUrl}?t=${Date.now()}`);

            // Check if file exists (Vite might return 200 OK with index.html for missing files)
            const contentType = imgRes.headers.get('content-type');
            if (!imgRes.ok || (contentType && contentType.includes('text/html'))) {
                throw new Error(`Template image MISSING: ${templateUrl} was not found. Please ensure you have converted the PDF to '${templateUrl}' and placed it in the 'public' folder.`);
            }

            const imageBytes = await imgRes.arrayBuffer();

            // Check for PDF renamed as JPG (Magic number %PDF is 0x25 0x50 0x44 0x46)
            const header = new Uint8Array(imageBytes.slice(0, 4));
            if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
                throw new Error(`Invalid Image Format: The file '${templateUrl}' appears to be a PDF renamed to JPG. Please convert it using a real online converter.`);
            }

            let embeddedImage;
            if (templateUrl.toLowerCase().endsWith('.png')) {
                embeddedImage = await finalDoc.embedPng(imageBytes);
            } else {
                // Try embedJpg, but handle error if it's actually PNG renamed to JPG
                try {
                    embeddedImage = await finalDoc.embedJpg(imageBytes);
                } catch (e) {
                    // Last ditch attempt: maybe it IS a png?
                    try {
                        embeddedImage = await finalDoc.embedPng(imageBytes);
                    } catch (e2) {
                        throw new Error(`Could not parse image '${templateUrl}'. It must be a valid JPG or PNG.`);
                    }
                }
            }

            const A4_WIDTH = 595.28;
            const A4_HEIGHT = 841.89;

            // Loop through content pages (usually 1)
            // Re-load content doc into this new context
            const contentDocForEmbed = await PDFDocument.load(contentPdfBytes);
            const embeddedContent = await finalDoc.embedPdf(contentDocForEmbed);

            const pageCount = Math.max(1, embeddedContent.length);

            for (let i = 0; i < pageCount; i++) {
                const finalPage = finalDoc.addPage([A4_WIDTH, A4_HEIGHT]);

                // Draw Background Image (Stretch to fit A4)
                finalPage.drawImage(embeddedImage, {
                    x: 0,
                    y: 0,
                    width: A4_WIDTH,
                    height: A4_HEIGHT,
                });

                // Draw Text Overlay
                if (embeddedContent[i]) {
                    finalPage.drawPage(embeddedContent[i], {
                        x: 0,
                        y: 0,
                        width: A4_WIDTH,
                        height: A4_HEIGHT,
                        blendMode: 'Normal' // Normal works best for Image backgrounds
                    });
                }
            }

            const pdfBytes = await finalDoc.save();
            const bytes = new Uint8Array(pdfBytes);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return 'data:application/pdf;base64,' + window.btoa(binary);

        } else {
            // --- EXISTING PDF STRATEGY ---
            // Load Template PDF (Base)
            console.log(`Fetching template: ${templateUrl}`);
            const templateRes = await fetch(`${templateUrl}?t=${Date.now()}`);
            if (!templateRes.ok) {
                throw new Error(`Template PDF not found: ${templateUrl}`);
            }
            const templatePdfBytes = await templateRes.arrayBuffer();

            // METHOD: Direct Load (Preserves original PDF structure safely)
            const finalDoc = await PDFDocument.load(templatePdfBytes);
            console.log("Template Loaded. Pages:", finalDoc.getPageCount());

            // Embed the *Content* into the *Template*
            // Use a fresh load of content to be safe
            const contentDocOverlay = await PDFDocument.load(contentPdfBytes);
            const embeddedContentPagesInTemplate = await finalDoc.embedPdf(contentDocOverlay);
            const contentPageCount = contentDocOverlay.getPageCount();

            // Ensure we have enough pages in the template
            while (finalDoc.getPageCount() < contentPageCount) {
                const [duplicatePage] = await finalDoc.copyPages(finalDoc, [0]);
                finalDoc.addPage(duplicatePage);
            }

            // Draw Content on each page
            const pages = finalDoc.getPages();
            for (let i = 0; i < contentPageCount; i++) {
                const finalPage = pages[i];
                const { width, height } = finalPage.getSize();

                if (embeddedContentPagesInTemplate[i]) {
                    finalPage.drawPage(embeddedContentPagesInTemplate[i], {
                        x: 0,
                        y: 0,
                        width: width,   // Adapt to strictly match existing page size
                        height: height, // Adapt to strictly match existing page size
                        opacity: 1,
                        blendMode: 'Darken' // Ensures text remains visible even if background is white
                    });
                }
            }

            // Remove unused pages if template had more pages than content
            while (finalDoc.getPageCount() > contentPageCount) {
                finalDoc.removePage(finalDoc.getPageCount() - 1);
            }

            const pdfBytes = await finalDoc.save();
            const bytes = new Uint8Array(pdfBytes);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return 'data:application/pdf;base64,' + window.btoa(binary);
        }

    } catch (err) {
        console.error("PDF Template Error:", err);
        throw err;
    }
};
