import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { generatePdfWithTemplate } from '../utils/pdfTemplateGenerator';

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'https://automated-offer-letter-generator.onrender.com';

const COMPANY_NAMES = {
    '/Arah_Template.pdf': 'Arah Infotech Pvt Ltd',
    '/UPlife.pdf': 'UP LIFE INDIA PVT LTD',
    '/Vagerious.pdf': 'VAGARIOUS SOLUTIONS PVT LTD',
    '/Zero7_A4.jpg': 'ZERO7 TECHNOLOGIES TRAINING & DEVELOPMENT'
};

const EditableContent = ({ initialContent, onChange }) => {
    const editorRef = React.useRef(null);

    React.useEffect(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = initialContent;
        }
    }, []);

    const handleInput = (e) => {
        onChange(e.currentTarget.innerHTML);
    };

    return (
        <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            style={{
                width: '100%',
                height: '100%',
                padding: '3rem',
                background: 'white',
                color: '#1e293b', // Dark text
                overflowY: 'auto',
                outline: 'none',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: '14px', // Readable edit size
                lineHeight: '1.6'
            }}
        />
    );
};

const LetterModal = ({ employee, onClose, onSuccess }) => {
    const [letterType, setLetterType] = useState('Offer Letter');
    const [generatedContent, setGeneratedContent] = useState(''); // Text content
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('pdf'); // 'pdf' or 'edit'

    const [selectedTemplate, setSelectedTemplate] = useState('/Arah_Template.pdf');

    // PDF State
    const [pdfUrl, setPdfUrl] = useState(null); // Data URI for Iframe
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const [emailBody, setEmailBody] = useState("");

    // Update Email Body when Template/Company Changes
    useEffect(() => {
        const company = COMPANY_NAMES[selectedTemplate] || 'Arah Infotech Pvt Ltd';
        setEmailBody(
            `Dear ${employee.name},\n\nWe are pleased to offer you the position at ${company}.\n\nPlease find the detailed offer letter attached.\n\nBest Regards,\nHR Team`
        );
    }, [selectedTemplate, employee.name]);

    // Auto-Generate on Mount
    useEffect(() => {
        // Optional: Auto-load draft? No, wait for user click or do it now?
        // Let's NOT auto-call AI to save cost/time, user clicks Generate.
    }, []);

    // Regenerate PDF when Template changes (if content exists)
    useEffect(() => {
        if (generatedContent && viewMode === 'pdf') {
            generatePreview(generatedContent);
        }
    }, [selectedTemplate]);


    const handleGenerate = () => {
        setLoading(true);
        setPdfUrl(null); // Clear previous

        fetch(`${API_URL}/letters/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: employee.id,
                letter_type: letterType,
                tone: "Professional",
                company_name: COMPANY_NAMES[selectedTemplate] || "Arah Infotech Pvt Ltd"
            })
        })
            .then(res => res.json())
            .then(async data => {
                setGeneratedContent(data.content);
                setLoading(false);

                // Immediately Generate PDF Preview
                await generatePreview(data.content);
            })
            .catch(err => {
                console.error("Error generating letter:", err);
                setLoading(false);
                setGeneratedContent("Error: Could not connect to AI Service.");
            });
    };

    const generatePreview = async (htmlContent) => {
        setIsGeneratingPdf(true);
        try {
            // Remove the Company Header (Logo/Address) to avoid double header with the PDF Template
            // This Regex removes the first centered div which usually contains the logo
            const contentWithoutHeader = htmlContent.replace(/<div style="text-align: center; border-bottom: 2px solid #0056b3;[\s\S]*?<\/div>/i, '');

            // Use current state for template
            const dataUri = await generatePdfWithTemplate(contentWithoutHeader, selectedTemplate);
            setPdfUrl(dataUri);
        } catch (e) {
            console.error(e);
            alert("Failed to render PDF template");
        }
        setIsGeneratingPdf(false);
        setViewMode('pdf');
    };

    const handleDownloadPDF = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${employee.name.replace(/\s+/g, '_')}_${letterType}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSendEmail = async () => {
        const btn = document.getElementById('emailBtn');
        btn.innerText = 'Sending...';

        try {
            // 1. Send to Backend
            const subject = `${letterType} - ${employee.name}`;

            // pdfUrl is "data:application/pdf;base64,JVBER..."
            // We need just the base64 part for the backend usually, depends on backend logic.
            // Backend expects `pdf_base64` which is usually the full Data URI or just the base64?
            // Looking at previous code `doc.output('datauristring')` returns full strings.
            // So pdfUrl is perfect.

            const res = await fetch(`${API_URL}/email/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: employee.id,
                    letter_content: generatedContent, // Valid for archiving text
                    pdf_base64: pdfUrl,
                    custom_message: emailBody,
                    subject: subject,
                    company_name: COMPANY_NAMES[selectedTemplate] || "Arah Infotech Pvt Ltd"
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
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: '#0f172a',
                    padding: '2rem',
                    borderRadius: '24px',
                    width: '1400px',
                    maxWidth: '98vw',
                    height: '95vh',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid #334155',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                {/* HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '1rem' }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#f1f5f9', fontSize: '1.8rem' }}>Generate Letter for {employee.name}</h2>
                        <p style={{ margin: '5px 0 0', color: '#94a3b8' }}>AI-Powered Generation with Official Template</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '2rem', cursor: 'pointer' }}>×</button>
                </div>

                {/* CONTROLS */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <select
                        value={letterType}
                        onChange={(e) => setLetterType(e.target.value)}
                        style={{
                            padding: '12px 20px', borderRadius: '8px', background: '#1e293b',
                            color: 'white', border: '1px solid #475569', flex: 1, fontSize: '1rem'
                        }}
                    >
                        <option>Offer Letter</option>
                        <option>Appraisal Letter</option>
                        <option>Experience Letter</option>
                        <option>Relieving Letter</option>
                    </select>

                    <select
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        style={{
                            padding: '12px 20px', borderRadius: '8px', background: '#1e293b',
                            color: 'white', border: '1px solid #475569', flex: 1, fontSize: '1rem'
                        }}
                    >
                        <option value="/Arah_Template.pdf">Arah Infotech</option>
                        <option value="/UPlife.pdf">UPlife</option>
                        <option value="/Vagerious.pdf">Vagerious</option>
                        <option value="/Zero7_A4.jpg">Zero7 (Image Version)</option>
                    </select>

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        style={{
                            background: loading ? '#475569' : '#646cff',
                            color: 'white', border: 'none', padding: '12px 30px',
                            borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
                            minWidth: '150px'
                        }}
                    >
                        {loading ? '✨ Thinking...' : '✨ Generate with AI'}
                    </button>

                    {/* VIEW TOGGLE */}
                    {generatedContent && (
                        <div style={{ display: 'flex', background: '#1e293b', borderRadius: '8px', border: '1px solid #475569', overflow: 'hidden' }}>
                            <button
                                onClick={() => setViewMode('edit')}
                                style={{
                                    padding: '12px 20px', border: 'none', cursor: 'pointer',
                                    background: viewMode === 'edit' ? '#334155' : 'transparent',
                                    color: viewMode === 'edit' ? 'white' : '#94a3b8', fontWeight: 'bold'
                                }}
                            >
                                ✏️ Edit Text
                            </button>
                            <button
                                onClick={() => {
                                    if (viewMode !== 'pdf') generatePreview(generatedContent);
                                    setViewMode('pdf');
                                }}
                                style={{
                                    padding: '12px 20px', border: 'none', cursor: 'pointer',
                                    background: viewMode === 'pdf' ? '#334155' : 'transparent',
                                    color: viewMode === 'pdf' ? 'white' : '#94a3b8', fontWeight: 'bold'
                                }}
                            >
                                📄 PDF Preview
                            </button>
                        </div>
                    )}
                </div>

                {/* PREVIEW AREA */}
                <div style={{
                    flex: 1,
                    background: '#1e293b', // Dark container
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                }}>
                    {!generatedContent && !loading && (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                            <p>Select a letter type and click Generate to see the preview.</p>
                        </div>
                    )}

                    {loading && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#646cff' }}>
                            <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #334155', borderTop: '4px solid #646cff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <p style={{ marginTop: '1rem' }}>Consulting AI & Formatting PDF...</p>
                        </div>
                    )}

                    {/* EDIT MODE: WYSIWYG Editor */}
                    {generatedContent && viewMode === 'edit' && !loading && (
                        <EditableContent
                            initialContent={generatedContent}
                            onChange={setGeneratedContent}
                        />
                    )}

                    {/* PDF MODE: Iframe */}
                    {generatedContent && viewMode === 'pdf' && !loading && (
                        <>
                            {isGeneratingPdf ? (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    Building PDF Preview...
                                </div>
                            ) : pdfUrl ? (
                                <iframe
                                    src={pdfUrl}
                                    style={{ width: '100%', height: '100%', border: 'none', background: '#525659' }}
                                    title="PDF Preview"
                                />
                            ) : (
                                <div style={{ padding: '2rem', color: 'red' }}>PDF Generation Failed.</div>
                            )}
                        </>
                    )}
                </div>

                {/* FOOTER ACTIONS */}
                {generatedContent && (
                    <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #334155' }}>
                        {/* Email Message Input */}
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                                📧 Email Body (Personal Note):
                            </label>
                            <textarea
                                value={emailBody}
                                onChange={e => setEmailBody(e.target.value)}
                                style={{
                                    width: '100%', height: '60px', borderRadius: '6px',
                                    background: '#1e293b', border: '1px solid #475569', color: 'white',
                                    padding: '10px', fontSize: '0.9rem', resize: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                            <button
                                onClick={handleDownloadPDF}
                                style={{
                                    background: '#1e293b', border: '2px solid #646cff', color: '#646cff',
                                    padding: '14px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                ⬇️ Download
                            </button>
                            <button
                                id="emailBtn"
                                onClick={handleSendEmail}
                                style={{
                                    background: '#646cff', border: 'none', color: 'white',
                                    padding: '14px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                ✉️ Send Email
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default LetterModal;
