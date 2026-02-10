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

    // Initial render only
    React.useEffect(() => {
        if (editorRef.current && initialContent && !editorRef.current.innerHTML) {
            editorRef.current.innerHTML = initialContent;
        }
    }, []);

    // If initialContent changes significantly (e.g. new generation), update it
    // But be careful not to overwrite user edits if it's just a small re-render
    React.useEffect(() => {
        if (editorRef.current && initialContent !== editorRef.current.innerHTML) {
            // Only update if the content is truly different (e.g. from AI generation)
            // avoiding overwriting if the user is typing (which updates state)
            // This is tricky. simpler: only update if the passed initialContent
            // doesn't match what we have, but we need to trust the parent pushes new content only when needed.
            // For now, let's trust the parent only sends new initialContent when it changes from source.

            // Check if the update is coming from our own input (loop)
            if (document.activeElement !== editorRef.current) {
                editorRef.current.innerHTML = initialContent;
            }
        }
    }, [initialContent]);

    const handleInput = (e) => {
        onChange(e.currentTarget.innerHTML);
    };

    return (
        <div
            ref={editorRef}
            className="document-editor"
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            style={{
                width: '100%',
                height: '100%',
                padding: '3rem',
                background: 'white',
                color: '#1e293b',
                overflowY: 'auto',
                outline: 'none',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: '14px',
                lineHeight: '1.6',
                boxShadow: '0 0 20px rgba(0,0,0,0.2)'
            }}
        />
    );
};



const LetterModal = ({ employee, onClose, onSuccess }) => {
    const [letterType, setLetterType] = useState('Offer Letter');
    const [generatedContent, setGeneratedContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('pdf');

    const [selectedTemplate, setSelectedTemplate] = useState('/Arah_Template.pdf');
    const [companyName, setCompanyName] = useState('Arah Infotech Pvt Ltd');
    const prevTemplateRef = React.useRef(selectedTemplate);

    const [pdfUrl, setPdfUrl] = useState(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const [emailBody, setEmailBody] = useState("");
    const fileInputRef = React.useRef(null);

    const handleCustomTemplateUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/upload/template-pdf`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Upload failed");
            setSelectedTemplate(data.url);
            alert(`Custom Template Uploaded! \n${data.filename}`);
        } catch (err) {
            console.error(err);
            alert("Upload failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-update content (text replacement) and email when template changes
    useEffect(() => {
        // If the selected template is a KNOWN one, switch the company name automatically.
        // If it's a custom one (not in map), we leave the current company name (or user can edit it).
        if (COMPANY_NAMES[selectedTemplate]) {
            setCompanyName(COMPANY_NAMES[selectedTemplate]);
        }
    }, [selectedTemplate]);

    useEffect(() => {
        const prevCompany = COMPANY_NAMES[prevTemplateRef.current] || 'Arah Infotech Pvt Ltd'; // Fallback for prev

        // Update Email Body
        setEmailBody(
            `Dear ${employee.name},\n\nWe are pleased to offer you the position at ${companyName}.\n\nPlease find the detailed offer letter attached.\n\nBest Regards,\nHR Team`
        );

        // Update Generated HTML Content if it exists
        if (generatedContent) {
            // Escape special chars for regex: . * + ? ^ $ { } ( ) | [ ] \
            const escapedPrev = prevCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedPrev, 'g');
            const newContent = generatedContent.replace(regex, companyName);

            if (newContent !== generatedContent) {
                setGeneratedContent(newContent);
                // Updating generatedContent will trigger the auto-preview effect below
            } else if (viewMode === 'pdf') {
                // Even if text didn't change, we must refresh PDF to show new background
                generatePreview(generatedContent);
            }
        }

        prevTemplateRef.current = selectedTemplate;
    }, [companyName, employee.name, selectedTemplate, generatedContent, viewMode]);

    // Auto-Preview when generatedContent changes
    useEffect(() => {
        if (!generatedContent || viewMode !== 'pdf') return;
        // Debounce only if typing (handled by typing effect? No, this is triggered by setGeneratedContent)
        // Note: We need immediate update if it was a template switch (handled above?)
        // Let's use a short delay or check if it was a bulk change.

        const timer = setTimeout(() => {
            generatePreview(generatedContent);
        }, 1000); // 1s delay
        return () => clearTimeout(timer);
    }, [generatedContent]);

    const handleGenerate = () => {
        setLoading(true);
        setPdfUrl(null);
        fetch(`${API_URL}/letters/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: employee.id,
                letter_type: letterType,
                tone: "Professional",
                company_name: companyName
            })
        })
            .then(res => res.json())
            .then(async data => {
                setGeneratedContent(data.content);
                setLoading(false);
                // Immediate preview
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
            // Clean up header for PDF (which has its own logo in background)
            const contentWithoutHeader = htmlContent.replace(/<div style="text-align: center; border-bottom: 2px solid #0056b3;[\s\S]*?<\/div>/i, '');
            const dataUri = await generatePdfWithTemplate(contentWithoutHeader, selectedTemplate);
            setPdfUrl(dataUri);
        } catch (e) {
            console.error(e);
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
        btn.disabled = true;

        try {
            const subject = `${letterType} - ${employee.name}`;
            const res = await fetch(`${API_URL}/email/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: employee.id,
                    letter_content: generatedContent,
                    pdf_base64: pdfUrl,
                    custom_message: emailBody,
                    subject: subject,
                    company_name: companyName
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
            btn.disabled = false;
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--modal-overlay)',
            backdropFilter: 'blur(5px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 3000
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: 'var(--bg-secondary)',
                    padding: '0.75rem',
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    border: 'none',
                }}
            >
                {/* COMPACT THEMED HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <div>
                        <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700 }}>
                            <span style={{ color: 'var(--accent-color)' }}>✨</span> Document Workshop: {employee.name}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#ef4444',
                            border: 'none',
                            color: 'white',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            fontSize: '1.2rem',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)'
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* THEMED CONTROLS */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap', background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '12px' }}>
                    <input
                        type="text"
                        placeholder="Company Name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        style={{
                            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', border: '1px solid var(--border-color)', flex: 1, fontSize: '0.9rem', outline: 'none', minWidth: '200px'
                        }}
                    />

                    <select
                        value={letterType}
                        onChange={(e) => setLetterType(e.target.value)}
                        style={{
                            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', border: '1px solid var(--border-color)', flex: 1, fontSize: '0.9rem', outline: 'none'
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
                            padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', border: '1px solid var(--border-color)', flex: 1, fontSize: '0.9rem', outline: 'none'
                        }}
                    >
                        <option value="/Arah_Template.pdf">Arah Infotech</option>
                        <option value="/UPlife.pdf">UPlife</option>
                        <option value="/Vagerious.pdf">Vagerious</option>
                        <option value="/Zero7_A4.jpg">Zero7 (Image Version)</option>
                    </select>

                    <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleCustomTemplateUpload} />
                    <button
                        onClick={() => fileInputRef.current.click()}
                        style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-secondary)', border: '1px dashed var(--border-color)',
                            padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: 600
                        }}
                    >
                        📤 Custom Template
                    </button>

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        style={{
                            background: loading ? 'var(--border-color)' : 'var(--accent-color)',
                            color: 'white', border: 'none', padding: '10px 24px',
                            borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
                            minWidth: '140px', fontSize: '0.95rem', boxShadow: 'var(--card-shadow)'
                        }}
                    >
                        {loading ? 'AI Working...' : '✨ Generate AI Draft'}
                    </button>
                </div>

                {/* SPLIT SCREEN area */}
                <div style={{ flex: 1, display: 'flex', gap: '1rem', overflow: 'hidden' }}>

                    {!generatedContent && !loading && (
                        <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '2px dashed var(--border-color)' }}>
                            <p style={{ fontSize: '1.1rem' }}>Choose a template and click <b>Generate</b> to begin mapping the future.</p>
                        </div>
                    )}

                    {loading && (
                        <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
                            <div className="spinner" style={{ width: '50px', height: '50px', border: '5px solid var(--border-color)', borderTop: '5px solid var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <p style={{ marginTop: '1.5rem', fontWeight: 600 }}>Synthesizing professional document...</p>
                        </div>
                    )}

                    {generatedContent && !loading && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div style={{ marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                ✏️ Rich Text Editor <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>(Auto-Syncing)</span>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', position: 'relative', padding: '10px' }}>
                                <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}>
                                    <div style={{ transform: 'scale(0.75)', transformOrigin: 'top center', width: '100%', height: '134%', display: 'flex', justifyContent: 'center' }}>
                                        <EditableContent initialContent={generatedContent} onChange={setGeneratedContent} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {generatedContent && !loading && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div style={{ marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>📄 PDF Synchronizer (75%)</span>
                                {isGeneratingPdf && <span style={{ color: 'var(--accent-color)', animation: 'pulse 1s infinite' }}>● Syncing</span>}
                            </div>
                            <div style={{ flex: 1, background: '#525659', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative' }}>
                                {pdfUrl ? (
                                    <iframe src={pdfUrl + "#toolbar=0&navpanes=0&zoom=75"} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Finalizing pixels...</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                {generatedContent && (
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                                📧 Messaging:
                            </label>
                            <textarea
                                value={emailBody}
                                onChange={e => setEmailBody(e.target.value)}
                                style={{
                                    width: '100%', height: '100px', borderRadius: '10px',
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)',
                                    padding: '12px', fontSize: '0.9rem', resize: 'none', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                            <button
                                onClick={handleDownloadPDF}
                                style={{
                                    background: 'var(--bg-secondary)', border: '2px solid var(--accent-color)', color: 'var(--accent-color)',
                                    padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem'
                                }}
                            >
                                ⬇️ Archive PDF
                            </button>
                            <button
                                id="emailBtn"
                                onClick={handleSendEmail}
                                style={{
                                    background: 'var(--accent-color)', border: 'none', color: 'white',
                                    padding: '12px 28px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem', boxShadow: 'var(--card-shadow)'
                                }}
                            >
                                ✉️ Dispatch to Candidate
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default LetterModal;
