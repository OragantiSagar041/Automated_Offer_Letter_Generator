import { useState, useEffect } from 'react';
import AddEmployeeModal from './components/AddEmployeeModal';
import LetterModal from './components/LetterModal';
import { generatePDFDoc } from './utils/pdfGenerator';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from './config';

function App() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
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

  const selectedBg = theme === 'dark' ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9';
  const unselectedBg = 'var(--card-bg)';

  const handleSelectAll = () => {
    const allFilteredIds = filteredEmployees.map(e => e.id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));

    if (allSelected) {
      const newSet = new Set(selectedIds);
      allFilteredIds.forEach(id => newSet.delete(id));
      setSelectedIds(newSet);
    } else {
      const newSet = new Set(selectedIds);
      allFilteredIds.forEach(id => newSet.add(id));
      setSelectedIds(newSet);
    }
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

      <header style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{
          fontSize: '3rem',
          marginBottom: '0.25rem',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px'
        }}>
          TalentScribe
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', letterSpacing: '2px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>
          Automated Offer Letter System
        </p>
      </header>

      {/* --- STATS SECTION --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
        {[
          { label: 'Total Candidates', val: stats.total, color: 'var(--accent-color)', icon: '👥' },
          { label: 'Offers Sent', val: stats.sent, color: 'var(--success-text)', icon: '🚀' },
          { label: 'Pending Action', val: stats.pending, color: 'var(--pending-text)', icon: '⏳' }
        ].map((s, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -5, boxShadow: 'var(--card-hover-shadow)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            style={{
              background: 'var(--card-bg)',
              padding: '2rem',
              borderRadius: '24px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--card-shadow)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: '160px'
            }}
          >
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>{s.label}</h3>
              <p style={{ margin: '10px 0 0', fontSize: '3.5rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>{s.val}</p>
            </div>
            {/* Background Decoration */}
            <div style={{
              position: 'absolute',
              right: '-10px',
              bottom: '-20px',
              fontSize: '8rem',
              opacity: 0.05,
              filter: 'grayscale(100%)',
              userSelect: 'none',
              pointerEvents: 'none'
            }}>
              {s.icon}
            </div>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '4px',
              background: s.color
            }} />
          </motion.div>
        ))}
      </div>

      {/* --- TOOLBAR --- */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>

          {/* SEGMENTED CONTROL TABS */}
          <div style={{
            display: 'inline-flex',
            background: 'var(--bg-tertiary)',
            padding: '6px',
            borderRadius: '16px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
          }}>
            {['All', 'Pending', 'Offer Sent'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  background: filterStatus === status ? 'var(--card-bg)' : 'transparent',
                  border: 'none',
                  borderRadius: '12px',
                  color: filterStatus === status ? 'var(--accent-color)' : 'var(--text-muted)',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  padding: '10px 24px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: filterStatus === status ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {status}
              </button>
            ))}
          </div>

          {/* SEARCH & ACTIONS */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>

            {/* VIEW TOGGLE */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '4px' }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: viewMode === 'grid' ? 'var(--card-bg)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--accent-color)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'grid' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s'
                }}
                title="Grid View"
              >
                🔳
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: viewMode === 'list' ? 'var(--card-bg)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--accent-color)' : 'var(--text-muted)',
                  boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.2s'
                }}
                title="List View"
              >
                ☰
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '12px 20px 12px 45px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  width: '300px',
                  background: 'var(--card-bg)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxShadow: 'var(--card-shadow)',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(5px)' // Added backdropFilter for glass effect
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
              />
              <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
            </div>



            <button
              onClick={handleSelectAll}
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '12px 18px',
                borderRadius: '16px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              title="Select All Visible"
            >
              <span>{filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id)) ? '☐ Deselect All' : '☑ Select All'}</span>
            </button>

            <button
              onClick={() => { setSelectedEmployeeForEdit(null); setIsModalOpen(true); }} // Changed to setIsModalOpen(true) as per original logic
              style={{
                background: 'var(--accent-gradient)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '16px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.95rem',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              <span>+</span> New Candidate
            </button>

            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkSend} // Changed to handleBulkSend as per original logic
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '12px 24px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                Draft ({selectedIds.size})
              </button>
            )}

            <button
              // Download Template Button
              onClick={() => {
                window.location.href = `${API_URL}/employees/template`;
              }}
              title="Download Import Template"
              style={{
                padding: '12px',
                aspectRatio: '1',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              📥
            </button>

            <button
              onClick={() => document.getElementById('importInput').click()}
              style={{
                background: '#10b981', color: 'white', border: 'none', padding: '12px 24px', // Adjusted padding for consistency
                borderRadius: '16px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', boxShadow: 'var(--card-shadow)'
              }}
            >
              📁 Import Excel
            </button>
          </div>
        </div>

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

      {/* --- EMPLOYEE LIST --- */}
      {
        loading ? (
          <div style={{ textAlign: 'center', padding: '6rem' }}>
            <div className="spinner" style={{ width: '60px', height: '60px', border: '6px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 2rem' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: 600 }}>Connecting to enterprise grid...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div style={{ background: 'var(--bg-secondary)', padding: '6rem', borderRadius: '30px', textAlign: 'center', border: '2px dashed var(--border-color)' }}>
            <p style={{ fontSize: '1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>No candidates match your criteria.</p>
          </div>
        ) : (
          <div style={{
            display: viewMode === 'grid' ? 'grid' : 'flex',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(350px, 1fr))' : 'none',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            {filteredEmployees.map(emp => (
              viewMode === 'grid' ? (
                // --- GRID ITEM ---
                <motion.div
                  key={emp.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -8, boxShadow: 'var(--card-hover-shadow)' }}
                  style={{
                    position: 'relative',
                    background: selectedIds.has(emp.id) ? selectedBg : unselectedBg,
                    padding: '2rem',
                    borderRadius: '24px',
                    border: selectedIds.has(emp.id) ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                    boxShadow: 'var(--card-shadow)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    transition: 'border 0.2s ease, background-color 0.2s ease',
                    height: '100%',
                    backdropFilter: 'blur(12px)'
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
                      <button onClick={() => handleEditEmployee(emp)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '8px', fontSize: '0.9rem', transition: 'background 0.2s', color: 'var(--text-secondary)' }} title="Edit">✏️</button>
                      <button onClick={() => handleDeleteEmployee(emp.id)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '8px', fontSize: '0.9rem', transition: 'background 0.2s', color: 'var(--text-secondary)' }} title="Delete">🗑️</button>
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
                      background: emp.status === 'Offer Sent' ? 'transparent' : 'var(--accent-gradient)',
                      border: emp.status === 'Offer Sent' ? `2px solid var(--accent-color)` : 'none',
                      color: emp.status === 'Offer Sent' ? 'var(--accent-color)' : 'white',
                      padding: '16px', borderRadius: '15px', fontWeight: '900', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s',
                      boxShadow: emp.status === 'Offer Sent' ? 'none' : '0 4px 15px rgba(99, 102, 241, 0.4)'
                    }}
                  >
                    {emp.status === 'Offer Sent' ? 'VIEW / RESEND' : 'GENERATE OFFER'}
                  </button>
                </motion.div>
              ) : (
                // --- LIST ITEM ---
                <motion.div
                  key={emp.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.005, backgroundColor: 'var(--bg-tertiary)' }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: selectedIds.has(emp.id) ? selectedBg : unselectedBg,
                    padding: '1.25rem 2rem',
                    borderRadius: '16px',
                    border: selectedIds.has(emp.id) ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
                    gap: '1rem',
                    transition: 'background 0.2s ease, border 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 2 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(emp.id)}
                      onChange={() => toggleSelection(emp.id)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                    />
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</h3>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{emp.designation}</p>
                    </div>
                  </div>

                  <div style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>
                    {emp.department}
                  </div>

                  <div style={{ flex: 1 }}>
                    {emp.status === 'Offer Sent' ? (
                      <span style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 800 }}>✅ SENT</span>
                    ) : (
                      <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>PENDING</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleEditEmployee(emp)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }} title="Edit">✏️</button>
                    <button onClick={() => handleDeleteEmployee(emp.id)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }} title="Delete">🗑️</button>
                  </div>

                  <button
                    onClick={() => setSelectedEmployee(emp)}
                    style={{
                      background: emp.status === 'Offer Sent' ? 'transparent' : 'var(--accent-gradient)',
                      border: emp.status === 'Offer Sent' ? `2px solid var(--accent-color)` : 'none',
                      color: emp.status === 'Offer Sent' ? 'var(--accent-color)' : 'white',
                      padding: '10px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
                      minWidth: '140px',
                      boxShadow: emp.status === 'Offer Sent' ? 'none' : '0 4px 10px rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    {emp.status === 'Offer Sent' ? 'VIEW / RESEND' : 'Generate'}
                  </button>
                </motion.div>
              )
            ))}
          </div>
        )
      }

      {
        importMsg && (
          <div style={{ textAlign: 'center', padding: '15px', background: 'var(--bg-tertiary)', borderRadius: '15px', color: 'var(--accent-color)', marginTop: '1.5rem', fontWeight: 700 }}>
            {importMsg}
          </div>
        )
      }

      {/* HIDDEN IMPORT INPUT */}
      <input type="file" id="importInput" style={{ display: 'none' }} accept=".csv, .xlsx" onChange={async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const formData = new FormData(); formData.append('file', file);
        setImportMsg("Processing...");
        try {
          const res = await fetch(`${API_URL}/employees/upload`, { method: 'POST', body: formData });
          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          alert(`Import Successful! Added: ${data.added}, Existing: ${data.existing}, Errors: ${data.errors}`);
          fetchEmployees();
        } catch (err) { alert("Import Failed: " + err.message); }
        finally { setImportMsg(""); e.target.value = null; }
      }} />

      {/* MODALS */}
      <AnimatePresence>
        {isModalOpen && <AddEmployeeModal onClose={() => { setIsModalOpen(false); setSelectedEmployeeForEdit(null); }} onSave={handleSaveEmployee} initialData={selectedEmployeeForEdit} />}
        {selectedEmployee && <LetterModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onSuccess={() => { setSelectedEmployee(null); fetchEmployees(); }} />}
      </AnimatePresence>

    </div >
  );
}

export default App;
