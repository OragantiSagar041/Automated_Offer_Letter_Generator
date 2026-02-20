import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { API_URL } from '../config';

const InputGroup = ({ label, name, type = "text", placeholder, value, onChange, disabled, required = false, options = null }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: '700',
            color: 'var(--text-muted)'
        }}>
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
        {options ? (
            <div style={{ position: 'relative' }}>
                <select
                    name={name}
                    value={value}
                    onChange={onChange}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '1rem',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                    ▼
                </div>
            </div>
        ) : (
            <input
                type={type}
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                disabled={disabled}
                required={required}
                autoComplete="off"
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: disabled ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'all 0.2s',
                    cursor: disabled ? 'not-allowed' : 'text',
                    colorScheme: 'dark' // Ensures calendar icon is light in dark mode
                }}
                onFocus={(e) => { if (!disabled) { e.target.style.borderColor = 'var(--accent-color)'; e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)' } }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none' }}
            />
        )}
    </div>
);

const AddEmployeeModal = ({ onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState(() => {
        if (initialData) {
            const typeLower = (initialData.employment_type || '').toLowerCase();
            const roleLower = (initialData.designation || '').toLowerCase();
            const isIntern = typeLower.includes('intern') || roleLower.includes('intern');

            return {
                ...initialData,
                employment_type: isIntern ? 'Internship' : 'Full Time',
                basic_salary: initialData.basic_salary || (initialData.ctc ? (initialData.ctc * 0.5) : '')
            };
        }
        return {
            emp_id: '',
            name: '',
            email: '',
            employment_type: 'Full Time',
            designation: '',
            department: '',
            joining_date: '',
            location: '',
            ctc: '',
            basic_salary: ''
        };
    });

    const handleChange = (e) => {
        let { name, value } = e.target;
        if (name === 'joining_date' && value.length > 10) value = '';
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const isIntern = formData.employment_type === 'Internship';
        const payload = {
            ...formData,
            basic_salary: isIntern ? 0 : (formData.basic_salary ? parseFloat(formData.basic_salary) : 0),
            ctc: isIntern ? 0 : (formData.ctc ? parseFloat(formData.ctc) : 0)
        };
        onSave(payload);
    };



    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--modal-overlay)',
            backdropFilter: 'blur(10px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 2000
        }}>
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                style={{
                    background: 'var(--card-bg)',
                    padding: '3rem',
                    borderRadius: '32px',
                    width: '1000px',
                    maxWidth: '95vw',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--card-shadow)'
                }}
            >
                {/* Header */}
                <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '2.2rem',
                        fontWeight: '800',
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem'
                    }}>
                        {initialData ? 'Update Employee Profile' : 'New Employee Onboarding'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1rem', fontWeight: '500' }}>
                        {initialData ? 'Refine details for high-performance offer letters.' : 'Empower your team with a new enterprise member.'}
                    </p>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <button
                        type="button"
                        onClick={() => window.open(`${API_URL}/employees/template`, '_blank')}
                        style={{
                            background: 'transparent', border: '1px dashed var(--accent-color)', color: 'var(--accent-color)',
                            padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
                            display: 'inline-flex', alignItems: 'center', gap: '8px'
                        }}
                    >
                        📥 Download Bulk Import Template
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '2.5rem' }}>

                    {/* Sections with subtle backgrounds */}
                    <div style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.4rem' }}>👤</span>
                            <span style={{ borderBottom: '2px solid var(--accent-color)', paddingBottom: '4px', fontWeight: 'bold' }}>Personal Information</span>
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem', alignItems: 'end' }}>
                            <div style={{ gridColumn: 'span 4' }}>
                                <InputGroup label="Employee ID" name="emp_id" placeholder="Enter ID (or leave for auto)" value={formData.emp_id} onChange={handleChange} />
                            </div>
                            <div style={{ gridColumn: 'span 8' }}>
                                <InputGroup label="Full Name" name="name" placeholder="e.g. Sarah Connor" value={formData.name} onChange={handleChange} required />
                            </div>
                            <div style={{ gridColumn: 'span 8' }}>
                                <InputGroup label="Email Address" name="email" type="email" placeholder="sarah@corp.com" value={formData.email} onChange={handleChange} required />
                            </div>
                            <div style={{ gridColumn: 'span 4' }}>
                                <InputGroup label="Joining Date" name="joining_date" type="date" value={formData.joining_date} onChange={handleChange} required />
                            </div>
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.4rem' }}>💼</span>
                            <span style={{ borderBottom: '2px solid #10b981', paddingBottom: '4px', fontWeight: 'bold' }}>Professional Details</span>
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <InputGroup label="Designation" name="designation" placeholder="e.g. Senior Principal" value={formData.designation} onChange={handleChange} required />
                            <InputGroup label="Department" name="department" placeholder="e.g. Cloud Operations" value={formData.department} onChange={handleChange} required />
                            <InputGroup label="Employment Type" name="employment_type" value={formData.employment_type} onChange={handleChange} options={['Full Time', 'Internship']} />
                            <InputGroup label="Location" name="location" placeholder="e.g. Bangalore, Remote" value={formData.location} onChange={handleChange} required />
                        </div>
                    </div>

                    {formData.employment_type === 'Full Time' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)' }}
                        >
                            <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '1.4rem' }}>₹</span>
                                <span style={{ borderBottom: '2px solid #f59e0b', paddingBottom: '4px', fontWeight: 'bold' }}>Compensation Structure</span>
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <InputGroup label="Annual CTC (₹)" name="ctc" type="number" value={formData.ctc} onChange={handleChange} required />
                                <InputGroup label="Basic Salary (Monthly) (₹)" name="basic_salary" type="number" value={formData.basic_salary} onChange={handleChange} />
                            </div>
                        </motion.div>
                    )}

                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', paddingTop: '2rem', borderTop: '2px solid var(--border-color)' }}>
                        <button type="button" onClick={onClose} style={{
                            flex: 1,
                            padding: '16px',
                            background: 'transparent',
                            border: '2px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                            Cancel
                        </button>
                        <button type="submit" style={{
                            flex: 2,
                            padding: '16px',
                            background: 'var(--accent-color)',
                            border: 'none',
                            color: 'white',
                            fontSize: '1.1rem',
                            fontWeight: '800',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            boxShadow: '0 8px 20px -5px rgba(99, 102, 241, 0.4)',
                            transition: 'transform 0.1s, background 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                        }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-hover)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'var(--accent-color)'}
                            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            {initialData ? 'Apply Updates' : 'Onboard Employee'}
                            <span style={{ fontSize: '1.3rem' }}>→</span>
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default AddEmployeeModal;
