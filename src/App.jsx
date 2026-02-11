import { useState, useEffect } from 'react';
import AddEmployeeModal from './components/AddEmployeeModal';
import LetterModal from './components/LetterModal';
import { generatePDFDoc } from './utils/pdfGenerator';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8000'
  : 'https://automated-offer-letter-generator.onrender.com';

function App() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // Sync theme with DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [importMsg, setImportMsg] = useState(null);

  const fetchEmployees = () => {
    setLoading(true);
    fetch(`${API_URL}/employees/`)
      .then(res => res.json())
      .then(data => {
        setEmployees(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch backend:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleSaveEmployee = (employeeData) => {
    const isEdit = !!selectedEmployeeForEdit;
    const url = isEdit
      ? `${API_URL}/employees/${selectedEmployeeForEdit.id}`
      : `${API_URL}/employees/`;
    const method = isEdit ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(employeeData)
    })
      .then(async res => {
        if (res.ok) {
          setIsModalOpen(false);
          setSelectedEmployeeForEdit(null);
          fetchEmployees();
        } else {
          try {
            const errorData = await res.json();
            const errorMsg = errorData.detail
              ? (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail))
              : "Unknown Error";
            alert(`Failed: ${errorMsg}`);
          } catch (e) {
            alert("Error saving employee.");
          }
        }
      })
      .catch(err => {
        console.error(err);
        alert("Network Error: " + err.message);
      });
  };

  const handleEditEmployee = (emp) => {
    setSelectedEmployeeForEdit(emp);
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (id) => {
    if (!confirm("Are you sure you want to delete this employee? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_URL}/employees/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchEmployees();
      } else {
        alert("Failed to delete.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkSend = async () => {
    if (!confirm(`Send Offer Letters to ${selectedIds.size} candidates?`)) return;
    setIsBulkSending(true);
    setBulkProgress(`Starting...`);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const empId = ids[i];
      const emp = employees.find(e => e.id === empId);
      if (!emp) continue;
      setBulkProgress(`Sending to ${emp.name} (${i + 1}/${ids.length})...`);
      try {
        const genRes = await fetch(`${API_URL}/letters/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: emp.id,
            letter_type: "Offer Letter",
            tone: "Professional"
          })
        });
        const genData = await genRes.json();
        const content = genData.content;
        const doc = await generatePDFDoc(content);
        const pdfBase64 = doc.output('datauristring');
        const subject = `Offer of Employment - ${emp.name}`;
        await fetch(`${API_URL}/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: emp.id,
            letter_content: content,
            pdf_base64: pdfBase64,
            subject: subject,
            custom_message: `Dear ${emp.name},\n\nWe are pleased to offer you a position at Arah Infotech.\nPlease find your offer letter attached.\n\nRegards,\nHR Team`
          })
        });
        successCount++;
      } catch (err) { console.error(`Failed for ${emp.name}`, err); }
    }
    setIsBulkSending(false);
    setBulkProgress("");
    alert(`Bulk Send Complete! Sent ${successCount}/${ids.length} emails.`);
    setSelectedIds(new Set());
    fetchEmployees();
  };

  const filteredEmployees = employees.filter(emp => {
    const name = emp.name || "";
    const designation = emp.designation || "";
    const department = emp.department || "";
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All' ? true : emp.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: employees.length,
    sent: employees.filter(e => e.status === 'Offer Sent').length,
    pending: employees.length - employees.filter(e => e.status === 'Offer Sent').length
  };

  return (
    <div className="container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* --- FLOATING THEME TOGGLE (BETTER POSITIONED & COMPACT) --- */}
      <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 1100 }}>
        <button
          onClick={toggleTheme}
          style={{
            padding: '8px 16px',
            borderRadius: '50px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
          className="theme-toggle-btn"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* BULK PROGRESS OVERLAY */}
      <AnimatePresence>
        {isBulkSending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'var(--modal-overlay)', zIndex: 9999,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white',
              backdropFilter: 'blur(10px)'
            }}
          >
            <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>🚀 Bulk Sending...</h2>
            <p style={{ fontSize: '1.5rem', marginTop: '1rem' }}>{bulkProgress}</p>
            <div style={{ marginTop: '2rem', width: '400px', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{
                width: `${(selectedIds.size > 0 ? (parseInt(bulkProgress.match(/\d+/)) / selectedIds.size) * 100 : 0)}%`,
                height: '100%', background: '#34d399', transition: 'width 0.4s ease'
              }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
        {/* LOGO CONTAINER to prevent "mixing" in light mode */}
        <div style={{
          display: 'inline-block',
          background: 'white',
          padding: '15px',
          borderRadius: '20px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <img
            src="/arah_logo.jpg"
            alt="Arah Infotech Logo"
            style={{ height: '80px', display: 'block' }}
          />
        </div>
        <h1 style={{
          fontSize: '3rem',
          marginBottom: '0.5rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '-0.5px'
        }}>
          Arah Infotech - Admin Portal
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', letterSpacing: '2px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.7 }}>
          Enterprise Offer Management System
        </p>
      </header>

      {/* --- STATS SECTION --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
        {[
          { label: 'Total Candidates', val: stats.total, color: 'var(--text-primary)', border: 'var(--border-color)' },
          { label: 'Offers Sent', val: stats.sent, color: 'var(--success-text)', border: 'var(--success-text)' },
          { label: 'Pending Action', val: stats.pending, color: 'var(--pending-text)', border: 'var(--pending-text)' }
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '24px', border: `1px solid ${s.border}`, textAlign: 'center', boxShadow: 'var(--card-shadow)' }}>
            <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 800 }}>{s.label}</h3>
            <p style={{ margin: '0.5rem 0 0', fontSize: '3.5rem', fontWeight: '900', color: s.color }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* --- TOOLBAR --- */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          {['All', 'Pending', 'Offer Sent'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                background: 'none', border: 'none',
                borderBottom: filterStatus === status ? '4px solid var(--accent-color)' : '4px solid transparent',
                color: filterStatus === status ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '1.1rem', fontWeight: '800', padding: '0.75rem 1.5rem', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {status}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>Employee Directory</h2>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="🔍 Search name or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '14px 24px', borderRadius: '15px', border: '2px solid var(--border-color)',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', width: '300px', outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-color)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
            />
            <button
              onClick={() => { setSelectedEmployeeForEdit(null); setIsModalOpen(true); }}
              style={{
                background: 'var(--accent-color)', color: 'white', border: 'none', padding: '14px 28px',
                borderRadius: '15px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', boxShadow: 'var(--card-shadow)'
              }}
            >
              + Add Employee
            </button>
            <button
              onClick={() => document.getElementById('importInput').click()}
              style={{
                background: '#10b981', color: 'white', border: 'none', padding: '14px 28px',
                borderRadius: '15px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', boxShadow: 'var(--card-shadow)'
              }}
            >
              📁 Import Excel
            </button>
            <input type="file" id="importInput" style={{ display: 'none' }} accept=".csv, .xlsx" onChange={async (e) => {
              const file = e.target.files[0]; if (!file) return;
              const formData = new FormData(); formData.append('file', file);
              setImportMsg("Processing...");
              try {
                const res = await fetch(`${API_URL}/employees/upload`, { method: 'POST', body: formData });
                const data = await res.json();
                setImportMsg(res.ok ? `✅ Added ${data.imported_count}` : `❌ Error: ${data.detail}`);
                fetchEmployees();
              } catch (err) { setImportMsg(`❌ Net Error: ${err.message}`); }
              e.target.value = null;
            }} />
          </div>
        </div>

        {selectedIds.size > 0 && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <button
              onClick={handleBulkSend}
              style={{
                background: '#e11d48', color: 'white', border: 'none', padding: '16px 40px',
                borderRadius: '50px', fontWeight: '900', fontSize: '1.2rem', cursor: 'pointer',
                boxShadow: '0 10px 25px rgba(225, 29, 72, 0.4)', animation: 'pulse 2s infinite'
              }}
            >
              🚀 Send Offers to ({selectedIds.size}) Candidates
            </button>
          </motion.div>
        )}

        {importMsg && (
          <div style={{ textAlign: 'center', padding: '15px', background: 'var(--bg-tertiary)', borderRadius: '15px', color: 'var(--accent-color)', marginTop: '1.5rem', fontWeight: 700 }}>
            {importMsg}
          </div>
        )}
      </div>

      {/* --- EMPLOYEE LIST --- */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '6rem' }}>
          <div className="spinner" style={{ width: '60px', height: '60px', border: '6px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 2rem' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: 600 }}>Connecting to enterprise grid...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div style={{ background: 'var(--bg-secondary)', padding: '6rem', borderRadius: '30px', textAlign: 'center', border: '2px dashed var(--border-color)' }}>
          <p style={{ fontSize: '1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>No candidates match your criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
          {filteredEmployees.map(emp => (
            <motion.div
              key={emp.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                position: 'relative', // For absolute positioning of edit/delete icons
                background: 'var(--card-bg)', padding: '2rem', borderRadius: '24px',
                border: selectedIds.has(emp.id) ? '3px solid var(--accent-color)' : '1px solid var(--border-color)',
                boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: '1.5rem', transition: 'all 0.2s ease',
                height: '100%' // Ensure consistent height in grid
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(emp.id)}
                    onChange={() => toggleSelection(emp.id)}
                    style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                  />
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', paddingRight: '60px' }}>{emp.name}</h3>
                    <p style={{ margin: 0, color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{emp.designation}</p>
                  </div>
                </div>
                {/* MOVED TO CORNER (As per TC_007) */}
                <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEditEmployee(emp)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '8px', fontSize: '0.9rem', transition: 'background 0.2s' }} title="Edit">✏️</button>
                  <button onClick={() => handleDeleteEmployee(emp.id)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '8px', fontSize: '0.9rem', transition: 'background 0.2s' }} title="Delete">🗑️</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}>{emp.department}</span>
                {emp.status === 'Offer Sent' && <span style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800 }}>✅ DISPATCHED</span>}
              </div>

              <button
                onClick={() => setSelectedEmployee(emp)}
                style={{
                  marginTop: 'auto', // Pushes button to bottom
                  width: '100%',
                  background: emp.status === 'Offer Sent' ? 'transparent' : 'var(--accent-color)',
                  border: `2px solid var(--accent-color)`,
                  color: emp.status === 'Offer Sent' ? 'var(--accent-color)' : 'white',
                  padding: '16px', borderRadius: '15px', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {emp.status === 'Offer Sent' ? 'VIEW / RESEND' : 'GENERATE OFFER'}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {isModalOpen && <AddEmployeeModal onClose={() => { setIsModalOpen(false); setSelectedEmployeeForEdit(null); }} onSave={handleSaveEmployee} initialData={selectedEmployeeForEdit} />}
      {selectedEmployee && <LetterModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onSuccess={() => { setSelectedEmployee(null); fetchEmployees(); }} />}
    </div>
  );
}

export default App;
