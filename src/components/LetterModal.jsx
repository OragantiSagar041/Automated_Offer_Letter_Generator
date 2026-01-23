import React, { useState } from 'react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'https://automated-offer-letter-generator.onrender.com';

const LetterModal = ({ employee, onClose, onSuccess }) => {
    const [letterType, setLetterType] = useState('Offer Letter');
    const [generatedContent, setGeneratedContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [emailBody, setEmailBody] = useState(
        `Dear ${employee.name},\n\nWe are pleased to offer you the position at Arah Infotech Pvt Ltd.\n\nPlease find the detailed offer letter attached.\n\nBest Regards,\nHR Team`
    );

    const handleGenerate = () => {
        setLoading(true);
        fetch(`${API_URL}/letters/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: employee.id,
                letter_type: letterType,
                tone: "Professional"
            })
        })
            .then(res => res.json())
            .then(data => {
                setGeneratedContent(data.content);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error generating letter:", err);
                setLoading(false);
                setGeneratedContent("Error: Could not connect to AI Service.");
            });
    };

    const generatePDFDoc = async () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const element = document.getElementById('letter-preview');

        if (element && generatedContent.trim().startsWith('<')) {
            // HTML Mode (using html2canvas)
            // Wait for images to load if any ? Assuming placeholder
            const canvas = await html2canvas(element, {
                scale: 2, // High resolution
                useCORS: true,
                logging: false,
                windowWidth: 1200 // Force wide render
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfWidth = 210; // A4 Width mm
            const pdfHeight = 297; // A4 Height mm

            const imgProps = doc.getImageProperties(imgData);
            let imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            let imgWidth = pdfWidth;

            // Scale to fit single page if too tall
            if (imgHeight > pdfHeight) {
                const ratio = pdfHeight / imgHeight;
                imgWidth = pdfWidth * ratio;
                imgHeight = pdfHeight;
            }

            // Center horizontally
            const x = (pdfWidth - imgWidth) / 2;
            doc.addImage(imgData, 'JPEG', x, 0, imgWidth, imgHeight);

        } else {
            // Text Mode (Fallback)
            // 1. Add Logo
            try {
                const img = new Image();
                img.src = '/arah_logo.jpg';
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = () => resolve();
                });
                doc.addImage(img, 'JPEG', 15, 10, 40, 40);
            } catch (e) {
                console.error("Logo Error:", e);
            }

            const splitText = doc.splitTextToSize(generatedContent, 180);
            let cursorY = 60;
            doc.setFontSize(12);
            doc.setFont("courier", "normal");
            splitText.forEach(line => {
                if (cursorY > 280) { doc.addPage(); cursorY = 20; }
                doc.text(line, 15, cursorY);
                cursorY += 7;
            });
        }
        return doc;
    };

    const handleDownloadPDF = async () => {
        const doc = await generatePDFDoc();
        doc.save(`${employee.name.replace(/\s+/g, '_')}_${letterType}.pdf`);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000
        }}>
            {/* ... render ... */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    background: '#1e293b',
                    padding: '4rem',
                    borderRadius: '24px',
                    width: '1400px',
                    maxWidth: '95vw',
                    maxHeight: '95vh',
                    overflowY: 'auto',
                    border: '1px solid #334155',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: '2rem' }}>Generate Letter for {employee.name}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <select
                        value={letterType}
                        onChange={(e) => setLetterType(e.target.value)}
                        style={{
                            flex: 1,
                            padding: '0.8rem',
                            borderRadius: '6px',
                            background: '#0f172a',
                            color: 'white',
                            border: '1px solid #334155'
                        }}
                    >
                        <option>Offer Letter</option>
                        <option>Appraisal Letter</option>
                        <option>Experience Letter</option>
                        <option>Relieving Letter</option>
                    </select>

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="btn-primary"
                        style={{ minWidth: '120px' }}
                    >
                        {loading ? 'Thinking...' : 'Generate AI Draft'}
                    </button>
                </div>

                <div id="letter-preview" style={{
                    flex: 1,
                    background: 'white', // White paper background for preview
                    color: '#1a1d24ff',
                    padding: '2rem',
                    borderRadius: '4px',
                    overflowY: 'auto',
                    fontFamily: 'serif',
                    lineHeight: '1.6',
                    whiteSpace: generatedContent.trim().startsWith('<') ? 'normal' : 'pre-wrap', // Reset for HTML
                    minHeight: '300px'
                }}>
                    {generatedContent ? (
                        generatedContent.trim().startsWith('<') ? (
                            <div dangerouslySetInnerHTML={{ __html: generatedContent }} />
                        ) : (
                            generatedContent
                        )
                    ) : (
                        <em style={{ color: '#64748b' }}>Select a letter type and click Generate to see the AI draft here...</em>
                    )}
                </div>

                {generatedContent && (
                    <>
                        <div style={{ marginTop: '2rem' }}>
                            <label style={{ display: 'block', marginBottom: '1rem', color: '#cbd5e1', fontSize: '1.2rem', fontWeight: 'bold' }}>
                                📧 Email Message (Edit before sending):
                            </label>
                            <textarea
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                style={{
                                    width: '100%',
                                    minHeight: '150px',
                                    background: '#0f172a',
                                    color: '#e2e8f0',
                                    border: '1px solid #334155',
                                    padding: '1.5rem',
                                    borderRadius: '12px',
                                    fontFamily: 'inherit',
                                    fontSize: '1.1rem',
                                    lineHeight: '1.6',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2.5rem', justifyContent: 'flex-end', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
                            <button
                                onClick={handleDownloadPDF}
                                style={{
                                    background: '#0f172a',
                                    border: '2px solid #646cff',
                                    color: '#646cff',
                                    padding: '16px 32px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1.1rem',
                                    fontWeight: 600
                                }}
                            >
                                ⬇️ Download PDF
                            </button>

                            <button
                                onClick={async () => {
                                    const btn = document.getElementById('emailBtn');
                                    btn.innerText = 'Generating PDF...';

                                    try {
                                        // 1. Generate PDF with Logo
                                        const doc = await generatePDFDoc();
                                        const pdfBase64 = doc.output('datauristring');

                                        btn.innerText = 'Sending Email...';

                                        // 2. Send to Backend
                                        // Dynamic Subject
                                        const subject = `${letterType} - ${employee.name}`; // e.g., "Experience Letter - John Doe"

                                        const res = await fetch(`${API_URL}/email/send`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                employee_id: employee.id,
                                                letter_content: generatedContent,
                                                pdf_base64: pdfBase64,
                                                custom_message: emailBody,
                                                subject: subject
                                            })
                                        });

                                        const data = await res.json();
                                        if (data.status === 'error') throw new Error(data.message);

                                        alert("Email Sent Successfully! 🚀");
                                        btn.innerText = 'Sent ✅';
                                        if (onSuccess) onSuccess();

                                    } catch (err) {
                                        console.error(err);
                                        alert("Failed: " + err.message);
                                        btn.innerText = 'Retry ❌';
                                    }
                                }}
                                id="emailBtn"
                                style={{
                                    background: '#646cff',
                                    color: 'white',
                                    border: 'none',
                                    padding: '16px 32px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1.1rem',
                                    fontWeight: 600
                                }}
                            >
                                ✉️ Send to Candidate
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
};

export default LetterModal;
