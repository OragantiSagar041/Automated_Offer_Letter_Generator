import { useState, useEffect } from 'react';
import AddEmployeeModal from './components/AddEmployeeModal';
import AddCompanyModal from './components/AddCompanyModal';
import LetterModal from './components/LetterModal';
import AgreementLetterModal from './components/AgreementLetterModal';
import BulkSendModal from './components/BulkSendModal';
import AgreementBulkSendModal from './components/AgreementBulkSendModal';
import { generateOfferLetterPdf } from './utils/offerLetterPdfGenerator';
import { generatePdfWithTemplate } from './utils/pdfTemplateGenerator';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from './config';

function App() {
  // ─── ACTIVE TAB ───
  const [activeTab, setActiveTab] = useState('offer'); // 'offer' | 'agreement'

  // ─── OFFER LETTER STATE ───
  const [employees, setEmployees] = useState([]);
  const [loadingOffer, setLoadingOffer] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [isEmployeeViewOnly, setIsEmployeeViewOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [importMsg, setImportMsg] = useState(null);

  // ─── AGREEMENT STATE ───
  const [companies, setCompanies] = useState([]);
  const [loadingAgreement, setLoadingAgreement] = useState(true);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedCompanyForEdit, setSelectedCompanyForEdit] = useState(null);
  const [isAgViewOnly, setIsAgViewOnly] = useState(false);
  const [agSearchTerm, setAgSearchTerm] = useState('');
  const [agFilterStatus, setAgFilterStatus] = useState('All');
  const [agFromDate, setAgFromDate] = useState('');
  const [agToDate, setAgToDate] = useState('');
  const [agViewMode, setAgViewMode] = useState('grid');
  const [agSelectedIds, setAgSelectedIds] = useState(new Set());
  const [isAgBulkSending, setIsAgBulkSending] = useState(false);
  const [showAgBulkModal, setShowAgBulkModal] = useState(false);
  const [agBulkProgress, setAgBulkProgress] = useState("");
  const [agImportMsg, setAgImportMsg] = useState(null);

  // ─── THEME ───
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // ─── FETCH OFFER EMPLOYEES ───
  const fetchEmployees = () => {
    setLoadingOffer(true);
    fetch(`${API_URL}/employees/`)
      .then(res => res.json())
      .then(data => { setEmployees(data || []); setLoadingOffer(false); })
      .catch(() => setLoadingOffer(false));
  };

  // ─── FETCH AGREEMENT COMPANIES ───
  const fetchCompanies = () => {
    setLoadingAgreement(true);
    fetch(`${API_URL}/agreement-companies/`)
      .then(res => res.json())
      .then(data => { setCompanies(data || []); setLoadingAgreement(false); })
      .catch(() => setLoadingAgreement(false));
  };

  useEffect(() => {
    fetchEmployees();
    fetchCompanies();
    const interval = setInterval(() => { fetchEmployees(); fetchCompanies(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ═══════════════════════════════════════════
  // OFFER LETTER HANDLERS
  // ═══════════════════════════════════════════
  const handleSaveEmployee = (data) => {
    const isEdit = !!selectedEmployeeForEdit;
    const url = isEdit ? `${API_URL}/employees/${selectedEmployeeForEdit.id}` : `${API_URL}/employees/`;
    fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(async res => {
        if (res.ok) { setIsModalOpen(false); setSelectedEmployeeForEdit(null); fetchEmployees(); }
        else { const e = await res.json(); alert(`Failed: ${typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)}`); }
      }).catch(err => alert("Network Error: " + err.message));
  };

  const handleEditEmployee = (emp) => { setSelectedEmployeeForEdit(emp); setIsEmployeeViewOnly(false); setIsModalOpen(true); };
  const handleViewEmployee = (emp) => { setSelectedEmployeeForEdit(emp); setIsEmployeeViewOnly(true); setIsModalOpen(true); };

  const handleDeleteEmployee = async (id) => {
    if (!confirm("Delete this employee?")) return;
    const res = await fetch(`${API_URL}/employees/${id}`, { method: 'DELETE' });
    if (res.ok) fetchEmployees(); else alert("Failed to delete.");
  };

  const toggleSelection = (id) => {
    const s = new Set(selectedIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedIds(s);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} employees?`)) return;
    await fetch(`${API_URL}/employees/bulk-delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(selectedIds) }) });
    setSelectedIds(new Set()); fetchEmployees();
  };

  const handleBulkSendStart = async (templateUrl, companyName, letterType) => {
    setShowBulkModal(false); setIsBulkSending(true); setBulkProgress("Starting...");
    const ids = Array.from(selectedIds); let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const emp = employees.find(e => e.id === ids[i]); if (!emp) continue;
      setBulkProgress(`Sending to ${emp.name} (${i + 1}/${ids.length})...`);
      try {
        const g = await fetch(`${API_URL}/letters/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: emp.id, letter_type: letterType, tone: "Professional", company_name: companyName }) });
        const gd = await g.json(); const c = gd.content;
        const clean = c.replace(/<div style="text-align: center; border-bottom: 2px solid #0056b3;[\s\S]*?<\/div>/i, '');
        const pdf = await generateOfferLetterPdf(clean, templateUrl);
        await fetch(`${API_URL}/email/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: emp.id, letter_content: c, pdf_base64: pdf, subject: `${letterType} - ${emp.name}`, custom_message: `Dear ${emp.name},\n\nPlease find your ${letterType} attached.\n\nRegards,\nHR Team`, company_name: companyName }) });
        ok++;
      } catch (err) { console.error(err); }
    }
    setIsBulkSending(false); setBulkProgress(""); alert(`Sent ${ok}/${ids.length}`); setSelectedIds(new Set()); fetchEmployees();
  };

  const filteredEmployees = employees.filter(emp => {
    const s = searchTerm.toLowerCase();
    const match = (emp.name || "").toLowerCase().includes(s) || (emp.designation || "").toLowerCase().includes(s) || (emp.department || "").toLowerCase().includes(s);

    let dateMatch = true;
    if (fromDate || toDate) {
      if (!emp.joining_date) {
        dateMatch = false;
      } else {
        try {
          const d = new Date(emp.joining_date).toISOString().split('T')[0];
          if (fromDate && d < fromDate) dateMatch = false;
          if (toDate && d > toDate) dateMatch = false;
        } catch (e) { dateMatch = false; }
      }
    }

    return match && dateMatch && (filterStatus === 'All' || emp.status === filterStatus);
  });

  const offerStats = {
    total: employees.length,
    sent: employees.filter(e => e.status === 'Offer Sent').length,
    accepted: employees.filter(e => e.status === 'Accepted').length,
    rejected: employees.filter(e => e.status === 'Rejected').length,
    pending: employees.filter(e => e.status === 'Pending' || !e.status).length
  };

  const handleSelectAll = () => {
    const all = filteredEmployees.map(e => e.id);
    const allSel = all.length > 0 && all.every(id => selectedIds.has(id));
    const s = new Set(selectedIds);
    all.forEach(id => allSel ? s.delete(id) : s.add(id));
    setSelectedIds(s);
  };

  // ═══════════════════════════════════════════
  // AGREEMENT HANDLERS
  // ═══════════════════════════════════════════
  const handleSaveCompany = (data) => {
    const isEdit = !!selectedCompanyForEdit;
    const url = isEdit ? `${API_URL}/agreement-companies/${selectedCompanyForEdit.id}` : `${API_URL}/agreement-companies/`;
    fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(async res => {
        if (res.ok) { setIsCompanyModalOpen(false); setSelectedCompanyForEdit(null); fetchCompanies(); }
        else { const e = await res.json(); alert(`Failed: ${typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)}`); }
      }).catch(err => alert("Network Error: " + err.message));
  };

  const handleEditCompany = (co) => { setSelectedCompanyForEdit(co); setIsAgViewOnly(false); setIsCompanyModalOpen(true); };
  const handleViewCompany = (co) => { setSelectedCompanyForEdit(co); setIsAgViewOnly(true); setIsCompanyModalOpen(true); };

  const handleDeleteCompany = async (id) => {
    if (!confirm("Delete this company?")) return;
    const res = await fetch(`${API_URL}/agreement-companies/${id}`, { method: 'DELETE' });
    if (res.ok) fetchCompanies(); else alert("Failed to delete.");
  };

  const agToggleSelection = (id) => {
    const s = new Set(agSelectedIds); s.has(id) ? s.delete(id) : s.add(id); setAgSelectedIds(s);
  };

  const handleAgBulkDelete = async () => {
    if (!confirm(`Delete ${agSelectedIds.size} companies?`)) return;
    for (const id of agSelectedIds) {
      await fetch(`${API_URL}/agreement-companies/${id}`, { method: 'DELETE' });
    }
    setAgSelectedIds(new Set()); fetchCompanies();
  };

  const handleAgBulkSendStart = async (templateUrl, companyName) => {
    setShowAgBulkModal(false); setIsAgBulkSending(true); setAgBulkProgress("Starting...");
    const ids = Array.from(agSelectedIds); let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const co = companies.find(c => c.id === ids[i]); if (!co) continue;
      setAgBulkProgress(`Sending to ${co.name} (${i + 1}/${ids.length})...`);
      try {
        const g = await fetch(`${API_URL}/agreement-letters/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: co.id, letter_type: "Agreement", tone: "Professional", company_name: companyName }) });
        const gd = await g.json(); const content = gd.content;
        const clean = content.replace(/<div style="text-align: center; border-bottom: 2px solid #0056b3;[\s\S]*?<\/div>/i, '');
        const pdf = await generatePdfWithTemplate(clean, templateUrl);
        await fetch(`${API_URL}/agreement-email/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: co.id, letter_content: content, pdf_base64: pdf, subject: `Agreement - ${co.name}`, custom_message: `Dear ${co.name},\n\nPlease find the agreement attached.\n\nRegards,\nTeam`, company_name: companyName }) });
        ok++;
      } catch (err) { console.error(err); }
    }
    setIsAgBulkSending(false); setAgBulkProgress(""); alert(`Sent ${ok}/${ids.length}`); setAgSelectedIds(new Set()); fetchCompanies();
  };

  const filteredCompanies = companies.filter(co => {
    const s = agSearchTerm.toLowerCase();
    const match = (co.name || "").toLowerCase().includes(s) || (co.email || "").toLowerCase().includes(s);

    let dateMatch = true;
    if (agFromDate || agToDate) {
      if (!co.joining_date) {
        dateMatch = false;
      } else {
        try {
          const d = new Date(co.joining_date).toISOString().split('T')[0];
          if (agFromDate && d < agFromDate) dateMatch = false;
          if (agToDate && d > agToDate) dateMatch = false;
        } catch (e) { dateMatch = false; }
      }
    }

    return match && dateMatch && (agFilterStatus === 'All' || co.status === agFilterStatus);
  });

  const agStats = {
    total: companies.length,
    sent: companies.filter(e => e.status === 'Agreement Sent').length,
    pending: companies.filter(e => e.status === 'Pending' || !e.status).length
  };

  const handleAgSelectAll = () => {
    const all = filteredCompanies.map(e => e.id);
    const allSel = all.length > 0 && all.every(id => agSelectedIds.has(id));
    const s = new Set(agSelectedIds);
    all.forEach(id => allSel ? s.delete(id) : s.add(id));
    setAgSelectedIds(s);
  };

  // ─── SHARED STYLES ───
  const selectedBg = theme === 'dark' ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9';
  const unselectedBg = 'var(--card-bg)';

  // ═══════════════════════════════════════════════════════════════════════
  //                             R E N D E R
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* THEME TOGGLE */}
      <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 1100 }}>
        <button onClick={toggleTheme} style={{ padding: '8px 16px', borderRadius: '50px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* BULK PROGRESS OVERLAY */}
      <AnimatePresence>
        {(isBulkSending || isAgBulkSending) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--modal-overlay)', zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', backdropFilter: 'blur(10px)' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>🚀 Bulk Sending...</h2>
            <p style={{ fontSize: '1.5rem', marginTop: '1rem' }}>{bulkProgress || agBulkProgress}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ────────── HEADER ────────── */}
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.25rem', fontWeight: 900, background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-1px' }}>
          TalentScribe
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', letterSpacing: '2px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>
          Automated Document Generation System
        </p>
      </header>

      {/* ────────── TAB SWITCHER ────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 2.5rem', gap: '0' }}>
        <div style={{ display: 'inline-flex', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '20px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)', border: '1px solid var(--border-color)' }}>
          {[
            { key: 'offer', label: '📄 Offer Letter', icon: '📄' },
            { key: 'agreement', label: '🤝 Agreement', icon: '🤝' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: activeTab === tab.key ? 'var(--accent-gradient)' : 'transparent',
                border: 'none',
                borderRadius: '16px',
                color: activeTab === tab.key ? 'white' : 'var(--text-muted)',
                fontSize: '1rem',
                fontWeight: activeTab === tab.key ? 800 : 600,
                padding: '14px 40px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: activeTab === tab.key ? '0 4px 15px rgba(99, 102, 241, 0.4)' : 'none',
                letterSpacing: activeTab === tab.key ? '0.3px' : '0',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════ */}
      {/*           OFFER LETTER TAB                */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'offer' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            {[
              { label: 'Total Candidates', val: offerStats.total, color: 'var(--accent-color)', icon: '👥' },
              { label: 'Offers Sent', val: offerStats.sent, color: '#3b82f6', icon: '🚀' },
              { label: 'Accepted', val: offerStats.accepted, color: 'var(--success-text)', icon: '✅' },
              { label: 'Rejected', val: offerStats.rejected, color: '#ef4444', icon: '❌' },
              { label: 'Pending', val: offerStats.pending, color: 'var(--pending-text)', icon: '⏳' }
            ].map((s, i) => (
              <motion.div key={i} whileHover={{ y: -5, boxShadow: 'var(--card-hover-shadow)' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '140px' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>{s.label}</h3>
                  <p style={{ margin: '10px 0 0', fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{s.val}</p>
                </div>
                <div style={{ position: 'absolute', right: '-10px', bottom: '-20px', fontSize: '7rem', opacity: 0.05, userSelect: 'none', pointerEvents: 'none' }}>{s.icon}</div>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: s.color }} />
              </motion.div>
            ))}
          </div>

          {/* TOOLBAR */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* FILTER TABS */}
              <div style={{ display: 'inline-flex', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '16px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                {['All', 'Pending', 'Offer Sent', 'Accepted', 'Rejected'].map(status => (
                  <button key={status} onClick={() => setFilterStatus(status)}
                    style={{ background: filterStatus === status ? 'var(--card-bg)' : 'transparent', border: 'none', borderRadius: '12px', color: filterStatus === status ? 'var(--accent-color)' : 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 700, padding: '10px 24px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: filterStatus === status ? '0 4px 12px rgba(0,0,0,0.08)' : 'none' }}>
                    {status}
                  </button>
                ))}
              </div>

              {/* ACTIONS */}
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* View toggle */}
                <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '4px' }}>
                  <button onClick={() => setViewMode('grid')} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: viewMode === 'grid' ? 'var(--card-bg)' : 'transparent', color: viewMode === 'grid' ? 'var(--accent-color)' : 'var(--text-muted)', transition: 'all 0.2s' }}>🔳</button>
                  <button onClick={() => setViewMode('list')} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: viewMode === 'list' ? 'var(--card-bg)' : 'transparent', color: viewMode === 'list' ? 'var(--accent-color)' : 'var(--text-muted)', transition: 'all 0.2s' }}>☰</button>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: '8px 10px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }} title="From Date" />
                  <span style={{ color: 'var(--text-muted)' }}>-</span>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: '8px 10px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }} title="To Date" />
                </div>

                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <input type="text" placeholder="Search candidates..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '10px 16px 10px 36px', borderRadius: '16px', border: '1px solid var(--border-color)', width: '200px', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', boxShadow: 'var(--card-shadow)' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'} onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'} />
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                </div>

                <button onClick={handleSelectAll} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: (filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id))) ? 'none' : '2px solid var(--border-color)', background: (filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id))) ? 'var(--accent-color)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px' }}>
                    {(filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id))) && '✓'}
                  </div>
                  Select All
                </button>

                <button onClick={() => { setSelectedEmployeeForEdit(null); setIsModalOpen(true); }}
                  style={{ background: 'var(--accent-gradient)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>+</span> New Candidate
                </button>

                {selectedIds.size > 0 && (<>
                  <button onClick={handleBulkDelete} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>Delete ({selectedIds.size})</button>
                  <button onClick={() => setShowBulkModal(true)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 18px', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>Draft ({selectedIds.size})</button>
                </>)}

                <button onClick={() => window.location.href = `${API_URL}/employees/template`} title="Download Template" style={{ padding: '10px', aspectRatio: '1', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>📥</button>
                <button onClick={() => document.getElementById('offerImportInput').click()} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>📁 Import Excel</button>
              </div>
            </div>
            <input type="file" id="offerImportInput" style={{ display: 'none' }} accept=".csv, .xlsx" onChange={async (e) => {
              const file = e.target.files[0]; if (!file) return;
              const fd = new FormData(); fd.append('file', file); setImportMsg("Processing...");
              try { const res = await fetch(`${API_URL}/employees/upload`, { method: 'POST', body: fd }); const d = await res.json(); setImportMsg(res.ok ? `✅ Added ${d.imported_count}` : `❌ Error`); fetchEmployees(); } catch (err) { setImportMsg(`❌ ${err.message}`); }
              e.target.value = null;
            }} />
          </div>

          {/* EMPLOYEE LIST */}
          {loadingOffer ? (
            <div style={{ textAlign: 'center', padding: '6rem' }}>
              <div className="spinner" style={{ width: '60px', height: '60px', margin: '0 auto 2rem' }} /><p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: 600 }}>Loading...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div style={{ background: 'var(--bg-secondary)', padding: '6rem', borderRadius: '30px', textAlign: 'center', border: '2px dashed var(--border-color)' }}><p style={{ fontSize: '1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>No candidates match your criteria.</p></div>
          ) : (
            <div style={{ display: viewMode === 'grid' ? 'grid' : 'flex', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(350px, 1fr))' : 'none', flexDirection: 'column', gap: '1.5rem' }}>
              {filteredEmployees.map(emp => (
                <motion.div key={emp.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: viewMode === 'grid' ? -8 : 0, boxShadow: 'var(--card-hover-shadow)' }}
                  style={{ position: 'relative', background: selectedIds.has(emp.id) ? selectedBg : unselectedBg, padding: viewMode === 'grid' ? '2rem' : '1.25rem 2rem', borderRadius: viewMode === 'grid' ? '24px' : '16px', border: selectedIds.has(emp.id) ? '2px solid var(--accent-color)' : '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: viewMode === 'grid' ? 'column' : 'row', alignItems: viewMode === 'grid' ? 'stretch' : 'center', gap: viewMode === 'grid' ? '1.5rem' : '1rem', justifyContent: viewMode === 'grid' ? 'flex-start' : 'space-between' }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: viewMode === 'list' ? '0 0 40%' : 'unset' }}>
                    <div onClick={(e) => { e.stopPropagation(); toggleSelection(emp.id); }} style={{ width: '22px', height: '22px', borderRadius: '6px', border: selectedIds.has(emp.id) ? 'none' : '2px solid var(--border-color)', background: selectedIds.has(emp.id) ? 'var(--accent-color)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: '14px', fontWeight: 'bold', flexShrink: 0 }}>
                      {selectedIds.has(emp.id) && '✓'}
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: viewMode === 'grid' ? '1.4rem' : '1.1rem', fontWeight: 800, color: 'var(--text-primary)', paddingRight: viewMode === 'grid' ? '60px' : '0' }}>{emp.name}</h3>
                      <p style={{ margin: 0, color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{emp.designation}</p>
                    </div>
                  </div>

                  {viewMode === 'grid' && (
                    <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleViewEmployee(emp)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="View">👁️</button>
                      <button onClick={() => handleEditEmployee(emp)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="Edit">✏️</button>
                      <button onClick={() => handleDeleteEmployee(emp.id)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="Delete">❌</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', flex: viewMode === 'list' ? 1 : 'unset' }}>
                    <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}>{emp.department}</span>
                    {viewMode === 'grid' && emp.status === 'Offer Sent' && <span style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800 }}>📩 SENT</span>}
                    {viewMode === 'grid' && emp.status === 'Accepted' && <span style={{ background: '#dcfce7', color: '#15803d', padding: '6px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800 }}>✅ ACCEPTED</span>}
                    {viewMode === 'grid' && emp.status === 'Rejected' && <span style={{ background: '#fecaca', color: '#991b1b', padding: '6px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800 }}>❌ REJECTED</span>}
                  </div>

                  {viewMode === 'list' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => handleViewEmployee(emp)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="View">👁️</button>
                      <button onClick={() => handleEditEmployee(emp)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="Edit">✏️</button>
                      <button onClick={() => handleDeleteEmployee(emp.id)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="Delete">❌</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', width: viewMode === 'list' ? '200px' : '100%', flexShrink: 0 }}>
                    <button onClick={() => setSelectedEmployee(emp)}
                      style={{ marginTop: viewMode === 'grid' ? 'auto' : '0', width: '100%', background: emp.status === 'Pending' || !emp.status ? 'var(--accent-gradient)' : 'transparent', border: emp.status === 'Pending' || !emp.status ? 'none' : `2px solid ${emp.status === 'Accepted' ? '#10b981' : emp.status === 'Rejected' ? '#ef4444' : 'var(--accent-color)'}`, color: emp.status === 'Pending' || !emp.status ? 'white' : (emp.status === 'Accepted' ? '#10b981' : emp.status === 'Rejected' ? '#ef4444' : 'var(--accent-color)'), padding: viewMode === 'grid' ? '16px' : '10px 15px', borderRadius: '15px', fontWeight: 900, fontSize: viewMode === 'grid' ? '1rem' : '0.85rem', cursor: 'pointer', boxShadow: emp.status === 'Pending' || !emp.status ? '0 4px 15px rgba(99, 102, 241, 0.4)' : 'none', whiteSpace: 'nowrap' }}>
                      {emp.status === 'Accepted' ? 'ACCEPTED ✅' : emp.status === 'Rejected' ? 'REJECTED' : emp.status === 'Offer Sent' ? 'VIEW / RESEND' : 'GENERATE OFFER'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {importMsg && <div style={{ textAlign: 'center', padding: '15px', background: 'var(--bg-tertiary)', borderRadius: '15px', color: 'var(--accent-color)', marginTop: '1.5rem', fontWeight: 700 }}>{importMsg}</div>}
        </motion.div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/*           AGREEMENT TAB                   */}
      {/* ══════════════════════════════════════════ */}
      {activeTab === 'agreement' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            {[
              { label: 'Total Companies', val: agStats.total, color: 'var(--accent-color)', icon: '🏢' },
              { label: 'Agreements Sent', val: agStats.sent, color: '#3b82f6', icon: '📩' },
              { label: 'Pending', val: agStats.pending, color: 'var(--pending-text)', icon: '⏳' }
            ].map((s, i) => (
              <motion.div key={i} whileHover={{ y: -5, boxShadow: 'var(--card-hover-shadow)' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '140px' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <h3 style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>{s.label}</h3>
                  <p style={{ margin: '10px 0 0', fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{s.val}</p>
                </div>
                <div style={{ position: 'absolute', right: '-10px', bottom: '-20px', fontSize: '7rem', opacity: 0.05, userSelect: 'none', pointerEvents: 'none' }}>{s.icon}</div>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: s.color }} />
              </motion.div>
            ))}
          </div>

          {/* TOOLBAR */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'inline-flex', background: 'var(--bg-tertiary)', padding: '6px', borderRadius: '16px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                {['All', 'Pending', 'Agreement Sent'].map(status => (
                  <button key={status} onClick={() => setAgFilterStatus(status)}
                    style={{ background: agFilterStatus === status ? 'var(--card-bg)' : 'transparent', border: 'none', borderRadius: '12px', color: agFilterStatus === status ? 'var(--accent-color)' : 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 700, padding: '10px 24px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: agFilterStatus === status ? '0 4px 12px rgba(0,0,0,0.08)' : 'none' }}>
                    {status}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '4px' }}>
                  <button onClick={() => setAgViewMode('grid')} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: agViewMode === 'grid' ? 'var(--card-bg)' : 'transparent', color: agViewMode === 'grid' ? 'var(--accent-color)' : 'var(--text-muted)' }}>🔳</button>
                  <button onClick={() => setAgViewMode('list')} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: agViewMode === 'list' ? 'var(--card-bg)' : 'transparent', color: agViewMode === 'list' ? 'var(--accent-color)' : 'var(--text-muted)' }}>☰</button>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="date" value={agFromDate} onChange={(e) => setAgFromDate(e.target.value)} style={{ padding: '8px 10px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }} title="From Date" />
                  <span style={{ color: 'var(--text-muted)' }}>-</span>
                  <input type="date" value={agToDate} onChange={(e) => setAgToDate(e.target.value)} style={{ padding: '8px 10px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }} title="To Date" />
                </div>

                <div style={{ position: 'relative' }}>
                  <input type="text" placeholder="Search companies..." value={agSearchTerm} onChange={(e) => setAgSearchTerm(e.target.value)}
                    style={{ padding: '10px 16px 10px 36px', borderRadius: '16px', border: '1px solid var(--border-color)', width: '200px', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', boxShadow: 'var(--card-shadow)' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'} onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'} />
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                </div>

                <button onClick={handleAgSelectAll} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: (filteredCompanies.length > 0 && filteredCompanies.every(co => agSelectedIds.has(co.id))) ? 'none' : '2px solid var(--border-color)', background: (filteredCompanies.length > 0 && filteredCompanies.every(co => agSelectedIds.has(co.id))) ? 'var(--accent-color)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px' }}>
                    {(filteredCompanies.length > 0 && filteredCompanies.every(co => agSelectedIds.has(co.id))) && '✓'}
                  </div>
                  Select All
                </button>

                <button onClick={() => { setSelectedCompanyForEdit(null); setIsCompanyModalOpen(true); }}
                  style={{ background: 'var(--accent-gradient)', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>+</span> New Company
                </button>

                {agSelectedIds.size > 0 && (<>
                  <button onClick={handleAgBulkDelete} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>Delete ({agSelectedIds.size})</button>
                  <button onClick={() => setShowAgBulkModal(true)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 18px', borderRadius: '14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>Draft ({agSelectedIds.size})</button>
                </>)}

                <button onClick={() => window.location.href = `${API_URL}/agreement-companies/template`} title="Download Template" style={{ padding: '10px', aspectRatio: '1', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>📥</button>
                <button onClick={() => document.getElementById('agImportInput').click()} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>📁 Import Excel</button>
              </div>
            </div>
            <input type="file" id="agImportInput" style={{ display: 'none' }} accept=".csv, .xlsx" onChange={async (e) => {
              const file = e.target.files[0]; if (!file) return;
              const fd = new FormData(); fd.append('file', file); setAgImportMsg("Processing...");
              try { const res = await fetch(`${API_URL}/agreement-companies/upload`, { method: 'POST', body: fd }); const d = await res.json(); setAgImportMsg(res.ok ? `✅ Added ${d.imported_count}` : `❌ Error`); fetchCompanies(); } catch (err) { setAgImportMsg(`❌ ${err.message}`); }
              e.target.value = null;
            }} />
          </div>

          {/* COMPANY LIST */}
          {loadingAgreement ? (
            <div style={{ textAlign: 'center', padding: '6rem' }}>
              <div className="spinner" style={{ width: '60px', height: '60px', margin: '0 auto 2rem' }} /><p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: 600 }}>Loading...</p>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div style={{ background: 'var(--bg-secondary)', padding: '6rem', borderRadius: '30px', textAlign: 'center', border: '2px dashed var(--border-color)' }}><p style={{ fontSize: '1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>No companies match your criteria.</p></div>
          ) : (
            <div style={{ display: agViewMode === 'grid' ? 'grid' : 'flex', gridTemplateColumns: agViewMode === 'grid' ? 'repeat(auto-fill, minmax(350px, 1fr))' : 'none', flexDirection: 'column', gap: '1.5rem' }}>
              {filteredCompanies.map(co => (
                <motion.div key={co.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: agViewMode === 'grid' ? -8 : 0, boxShadow: 'var(--card-hover-shadow)' }}
                  style={{ position: 'relative', background: agSelectedIds.has(co.id) ? selectedBg : unselectedBg, padding: agViewMode === 'grid' ? '2rem' : '1.25rem 2rem', borderRadius: agViewMode === 'grid' ? '24px' : '16px', border: agSelectedIds.has(co.id) ? '2px solid var(--accent-color)' : '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: agViewMode === 'grid' ? 'column' : 'row', alignItems: agViewMode === 'grid' ? 'stretch' : 'center', gap: agViewMode === 'grid' ? '1.5rem' : '1rem', justifyContent: agViewMode === 'grid' ? 'flex-start' : 'space-between' }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: agViewMode === 'list' ? '0 0 40%' : 'unset' }}>
                    <div onClick={(e) => { e.stopPropagation(); agToggleSelection(co.id); }} style={{ width: '22px', height: '22px', borderRadius: '6px', border: agSelectedIds.has(co.id) ? 'none' : '2px solid var(--border-color)', background: agSelectedIds.has(co.id) ? 'var(--accent-color)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: '14px', fontWeight: 'bold', flexShrink: 0 }}>
                      {agSelectedIds.has(co.id) && '✓'}
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: agViewMode === 'grid' ? '1.4rem' : '1.1rem', fontWeight: 800, color: 'var(--text-primary)', paddingRight: agViewMode === 'grid' ? '60px' : '0' }}>{co.name}</h3>
                      <p style={{ margin: 0, color: 'var(--accent-color)', fontSize: '0.85rem', fontWeight: 700 }}>{co.email}</p>
                    </div>
                  </div>

                  {agViewMode === 'grid' && (
                    <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleViewCompany(co)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="View">👁️</button>
                      <button onClick={() => handleEditCompany(co)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="Edit">✏️</button>
                      <button onClick={() => handleDeleteCompany(co.id)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="Delete">❌</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', flex: agViewMode === 'list' ? 1 : 'unset' }}>
                    {co.compensation?.percentage > 0 && <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}>{co.compensation.percentage}%</span>}
                    {agViewMode === 'grid' && co.status === 'Agreement Sent' && <span style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 800 }}>📩 SENT</span>}
                    {agViewMode === 'grid' && (co.status === 'Pending' || !co.status) && <span style={{ background: 'var(--pending-bg)', color: 'var(--pending-text)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}>PENDING</span>}
                  </div>

                  {agViewMode === 'list' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => handleViewCompany(co)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="View">👁️</button>
                      <button onClick={() => handleEditCompany(co)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="Edit">✏️</button>
                      <button onClick={() => handleDeleteCompany(co.id)} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title="Delete">❌</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', width: agViewMode === 'list' ? '220px' : '100%', flexShrink: 0 }}>
                    <button onClick={() => setSelectedCompany(co)}
                      style={{ marginTop: agViewMode === 'grid' ? 'auto' : '0', width: '100%', background: co.status === 'Agreement Sent' ? 'transparent' : 'var(--accent-gradient)', border: co.status === 'Agreement Sent' ? '2px solid var(--accent-color)' : 'none', color: co.status === 'Agreement Sent' ? 'var(--accent-color)' : 'white', padding: agViewMode === 'grid' ? '16px' : '10px 15px', borderRadius: '15px', fontWeight: 900, fontSize: agViewMode === 'grid' ? '1rem' : '0.85rem', cursor: 'pointer', boxShadow: co.status === 'Agreement Sent' ? 'none' : '0 4px 15px rgba(99, 102, 241, 0.4)', whiteSpace: 'nowrap' }}>
                      {co.status === 'Agreement Sent' ? 'VIEW / RESEND' : 'GENERATE AGREEMENT'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {agImportMsg && <div style={{ textAlign: 'center', padding: '15px', background: 'var(--bg-tertiary)', borderRadius: '15px', color: 'var(--accent-color)', marginTop: '1.5rem', fontWeight: 700 }}>{agImportMsg}</div>}
        </motion.div>
      )}

      {/* ════════════ MODALS ════════════ */}
      <AnimatePresence>
        {/* Offer Letter Modals */}
        {showBulkModal && <BulkSendModal selectedCount={selectedIds.size} onClose={() => setShowBulkModal(false)} onStart={handleBulkSendStart} />}
        {isModalOpen && <AddEmployeeModal onClose={() => { setIsModalOpen(false); setSelectedEmployeeForEdit(null); }} onSave={handleSaveEmployee} initialData={selectedEmployeeForEdit} isViewOnly={isEmployeeViewOnly} />}
        {selectedEmployee && <LetterModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onSuccess={() => { setSelectedEmployee(null); fetchEmployees(); }} />}

        {/* Agreement Modals */}
        {showAgBulkModal && <AgreementBulkSendModal selectedCount={agSelectedIds.size} onClose={() => setShowAgBulkModal(false)} onConfirm={handleAgBulkSendStart} />}
        {isCompanyModalOpen && <AddCompanyModal onClose={() => { setIsCompanyModalOpen(false); setSelectedCompanyForEdit(null); }} onSave={handleSaveCompany} initialData={selectedCompanyForEdit} isViewOnly={isAgViewOnly} />}
        {selectedCompany && <AgreementLetterModal employee={selectedCompany} onClose={() => setSelectedCompany(null)} onSuccess={() => { setSelectedCompany(null); fetchCompanies(); }} />}
      </AnimatePresence>

    </div>
  );
}

export default App;
