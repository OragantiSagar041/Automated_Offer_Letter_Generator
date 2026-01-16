import React, { useState } from 'react';
import { motion } from 'framer-motion';

const AddEmployeeModal = ({ onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState(initialData ? {
        ...initialData,
        basic_salary: initialData.basic_salary || (initialData.ctc ? (initialData.ctc * 0.5) : '')
    } : {
        emp_id: '',
        name: '',
        email: '',
        designation: '',
        department: '',
        joining_date: '',
        location: '',
        ctc: '',
        basic_salary: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    background: '#1e293b',
                    padding: '4rem',
                    borderRadius: '24px',
                    width: '1200px',
                    maxWidth: '95vw',
                    border: '1px solid #334155',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
            >
                <h2 style={{ marginTop: 0, color: '#f1f5f9', fontSize: '2rem', marginBottom: '2rem' }}>
                    {initialData ? 'Edit Employee / Payroll' : 'Add New Employee'}
                </h2>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Employee ID</label>
                            <input required name="emp_id" placeholder="EMP001" value={formData.emp_id} onChange={handleChange} disabled={!!initialData}
                                style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid #475569', background: initialData ? '#1e293b' : '#334155', color: initialData ? '#94a3b8' : 'white', cursor: initialData ? 'not-allowed' : 'text' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Joining Date</label>
                            <input required type="date" name="joining_date" value={formData.joining_date} onChange={handleChange}
                                style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid #475569', background: '#334155', color: 'white' }} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Full Name</label>
                        <input required name="name" placeholder="John Doe" value={formData.name} onChange={handleChange}
                            style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid #475569', background: '#334155', color: 'white' }} />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Email</label>
                        <input required type="email" name="email" placeholder="john@company.com" value={formData.email} onChange={handleChange}
                            style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid #475569', background: '#334155', color: 'white' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Designation</label>
                            <input required name="designation" placeholder="Software Engineer" value={formData.designation} onChange={handleChange}
                                style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid #475569', background: '#334155', color: 'white' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Department</label>
                            <input required name="department" placeholder="Engineering" value={formData.department} onChange={handleChange}
                                style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid #475569', background: '#334155', color: 'white' }} />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Location</label>
                        <input required name="location" placeholder="New York, Remote" value={formData.location} onChange={handleChange}
                            style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid #475569', background: '#334155', color: 'white' }} />
                    </div>

                    <h3 style={{ margin: '1rem 0 0.5rem', color: '#646cff', fontSize: '1.5rem' }}>Payroll Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Annual CTC</label>
                            <input required type="number" name="ctc" placeholder="1200000" value={formData.ctc} onChange={handleChange}
                                style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid #475569', background: '#334155', color: 'white' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.8rem', fontSize: '1.2rem', fontWeight: 'bold' }}>Basic Salary (Optional)</label>
                            <input type="number" name="basic_salary" placeholder="Auto-calculated if empty" value={formData.basic_salary} onChange={handleChange}
                                style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid #475569', background: '#334155', color: 'white' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} style={{
                            background: 'transparent', border: '2px solid #64748b', color: '#cbd5e1', padding: '16px 32px', fontSize: '1.2rem', borderRadius: '8px', cursor: 'pointer'
                        }}>Cancel</button>
                        <button type="submit" className="btn-primary" style={{
                            padding: '16px 32px', fontSize: '1.2rem', borderRadius: '8px', cursor: 'pointer', background: '#646cff', color: 'white', border: 'none', fontWeight: 'bold'
                        }}>
                            {initialData ? 'Update Employee' : 'Save Employee'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default AddEmployeeModal;
