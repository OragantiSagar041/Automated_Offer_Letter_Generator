import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const COMPANY_NAMES = {
    '/Arah_Template.pdf': 'Arah Infotech Pvt Ltd',
    '/UPlife.pdf': 'UP LIFE INDIA PVT LTD',
    '/Vagerious.pdf': 'VAGARIOUS SOLUTIONS PVT LTD',
    '/Zero7_A4.jpg': 'ZERO7 TECHNOLOGIES TRAINING & DEVELOPMENT'
};

const BulkSendModal = ({ selectedCount, onClose, onStart }) => {
    const [letterType, setLetterType] = useState('Offer Letter');
    const [selectedTemplate, setSelectedTemplate] = useState('/Arah_Template.pdf');
    const [companyName, setCompanyName] = useState('Arah Infotech Pvt Ltd');

    useEffect(() => {
        if (COMPANY_NAMES[selectedTemplate]) {
            setCompanyName(COMPANY_NAMES[selectedTemplate]);
        }
    }, [selectedTemplate]);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--modal-overlay)',
            backdropFilter: 'blur(5px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 3000
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: 'var(--card-bg)',
                    padding: '2.5rem',
                    borderRadius: '24px',
                    width: '500px',
                    maxWidth: '90vw',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--card-shadow)'
                }}
            >
                <h2 style={{ marginTop: 0, fontSize: '1.8rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    🚀 Bulk Output Setup
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    You are generating letters for <strong>{selectedCount}</strong> candidate(s). Choose your preferred background templates.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Letter Header Template</label>
                        <select
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none' }}
                        >
                            <option value="/Arah_Template.pdf">Arah Infotech</option>
                            <option value="/UPlife.pdf">UPlife</option>
                            <option value="/Vagerious.pdf">Vagarious</option>
                            <option value="/Zero7_A4.jpg">Zero7</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Company Name</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Letter Type</label>
                        <select
                            value={letterType}
                            onChange={(e) => setLetterType(e.target.value)}
                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none' }}
                        >
                            <option>Offer Letter</option>
                            <option>Internship Letter</option>
                            <option>Appraisal Letter</option>
                            <option>Experience Letter</option>
                            <option>Relieving Letter</option>
                            <option>Others</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'transparent', border: '2px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Cancel
                    </button>
                    <button onClick={() => onStart(selectedTemplate, companyName, letterType)} style={{ flex: 2, padding: '12px', background: 'var(--accent-color)', border: 'none', color: 'white', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)' }}>
                        Start Generating →
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default BulkSendModal;
