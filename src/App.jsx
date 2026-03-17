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
import {
  Users, Rocket, CheckCircle, XCircle, Clock,
  Search, LayoutGrid, List, Plus, Download,
  Upload, Eye, Pencil, Trash2, Sun, Moon,
  FileText, Handshake, Mail, Send, Trash, Check,
  Calendar
} from 'lucide-react';

function App() {
  // ─── ACTIVE TAB ───
  const [activeTab, setActiveTab] = useState('offer');

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
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // ─── DATA FETCHING ───
  const fetchEmployees = () => {
    setLoadingOffer(true);
    fetch(`${API_URL}/employees/`)
      .then(res => res.json())
      .then(data => { setEmployees(data || []); setLoadingOffer(false); })
      .catch(() => setLoadingOffer(false));
  };

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
    const interval = setInterval(() => { fetchEmployees(); fetchCompanies(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ────────── HANDLERS ──────────
  const handleSaveEmployee = (data) => {
    const isEdit = !!selectedEmployeeForEdit;
    fetch(`${API_URL}/employees/${isEdit ? selectedEmployeeForEdit.id : ''}`, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(async res => {
      if (res.ok) { setIsModalOpen(false); setSelectedEmployeeForEdit(null); fetchEmployees(); }
      else { const e = await res.json(); alert(`Failed: ${e.detail}`); }
    });
  };

  const handleEditEmployee = (emp) => { setSelectedEmployeeForEdit(emp); setIsEmployeeViewOnly(false); setIsModalOpen(true); };
  const handleViewEmployee = (emp) => { setSelectedEmployeeForEdit(emp); setIsEmployeeViewOnly(true); setIsModalOpen(true); };
  const handleDeleteEmployee = async (id) => {
    if (!confirm("Delete selection?")) return;
    await fetch(`${API_URL}/employees/${id}`, { method: 'DELETE' });
    fetchEmployees();
  };

  const toggleAllSelection = () => {
    const visibleIds = filteredEmployees.map(e => e.id);
    const allSelected = visibleIds.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) visibleIds.forEach(id => next.delete(id));
    else visibleIds.forEach(id => next.add(id));
    setSelectedIds(next);
  };

  const handleBulkSendOffer = async (template, company, type) => {
    setShowBulkModal(false);
    setIsBulkSending(true);
    const idsArray = Array.from(selectedIds);
    let count = 0;
    for (const id of idsArray) {
      const emp = employees.find(e => e.id === id);
      if (!emp) continue;
      setBulkProgress(`Processing ${++count}/${idsArray.length}: ${emp.name}`);
      try {
        const genRes = await fetch(`${API_URL}/letters/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: id, letter_type: type, company_name: company })
        });
        const genData = await genRes.json();
        const contentWithoutHeader = genData.content.replace(/<div style="text-align: center; border-bottom: 2px solid #0056b3;[\s\S]*?<\/div>/i, '');
        const pdfDataUri = await generateOfferLetterPdf(contentWithoutHeader, template);
        await fetch(`${API_URL}/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: id,
            letter_content: genData.content,
            pdf_base64: pdfDataUri,
            subject: `${type} - ${emp.name}`,
            company_name: company
          })
        });
      } catch (err) { console.error(err); }
    }
    setIsBulkSending(false);
    setBulkProgress("");
    setSelectedIds(new Set());
    fetchEmployees();
    alert("Bulk sending process completed! Check individual statuses.");
  };

  const filteredEmployees = employees.filter(emp => {
    const s = searchTerm.toLowerCase();
    const matchNameOrDesig = (emp.name || "").toLowerCase().includes(s) || (emp.designation || "").toLowerCase().includes(s);

    // Status Filter
    const matchStatus = filterStatus === 'All' || emp.status === filterStatus;

    // Date Filter
    let matchDate = true;
    if (fromDate || toDate) {
      // Try created_at, then joining_date as fallback
      const dateVal = emp.created_at || emp.joining_date;
      const d = dateVal ? new Date(dateVal) : null;

      if (d && !isNaN(d.getTime())) {
        if (fromDate) {
          const start = new Date(fromDate);
          start.setHours(0, 0, 0, 0);
          if (d < start) matchDate = false;
        }
        if (toDate) {
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          if (d > end) matchDate = false;
        }
      } else {
        matchDate = false;
      }
    }

    return matchNameOrDesig && matchStatus && matchDate;
  });

  const offerStats = {
    total: employees.length,
    sent: employees.filter(e => e.status === 'Offer Sent').length,
    accepted: employees.filter(e => e.status === 'Accepted').length,
    rejected: employees.filter(e => e.status === 'Rejected').length,
    pending: employees.filter(e => e.status === 'Pending' || !e.status).length
  };

  // ────────── AGREEMENT HANDLERS ──────────
  const handleSaveCompany = (data) => {
    const isEdit = !!selectedCompanyForEdit;
    fetch(`${API_URL}/agreement-companies/${isEdit ? selectedCompanyForEdit.id : ''}`, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(async res => {
      if (res.ok) { setIsCompanyModalOpen(false); setSelectedCompanyForEdit(null); fetchCompanies(); }
      else { const e = await res.json(); alert(`Failed: ${e.detail}`); }
    });
  };

  const handleEditCompany = (co) => { setSelectedCompanyForEdit(co); setIsAgViewOnly(false); setIsCompanyModalOpen(true); };
  const handleViewCompany = (co) => { setSelectedCompanyForEdit(co); setIsAgViewOnly(true); setIsCompanyModalOpen(true); };
  const toggleAllAgSelection = () => {
    const visibleIds = filteredCompanies.map(c => c.id);
    const allSelected = visibleIds.every(id => agSelectedIds.has(id));
    const next = new Set(agSelectedIds);
    if (allSelected) visibleIds.forEach(id => next.delete(id));
    else visibleIds.forEach(id => next.add(id));
    setAgSelectedIds(next);
  };

  const handleBulkSendAgreements = async (template, company) => {
    setShowAgBulkModal(false);
    setIsAgBulkSending(true);
    const idsArray = Array.from(agSelectedIds);
    let count = 0;
    for (const id of idsArray) {
      const co = companies.find(c => c.id === id);
      if (!co) continue;
      setAgBulkProgress(`Processing ${++count}/${idsArray.length}: ${co.name}`);
      try {
        const genRes = await fetch(`${API_URL}/agreement-letters/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: id, letter_type: "Agreement", company_name: company })
        });
        const genData = await genRes.json();
        const contentWithoutHeader = genData.content.replace(/<div style="text-align: center; border-bottom: 2px solid #0056b3;[\s\S]*?<\/div>/i, '');
        const pdfDataUri = await generatePdfWithTemplate(contentWithoutHeader, template);
        await fetch(`${API_URL}/agreement-email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: id,
            letter_content: genData.content,
            pdf_base64: pdfDataUri,
            subject: `Agreement - ${co.name}`,
            company_name: company
          })
        });
      } catch (err) { console.error(err); }
    }
    setIsAgBulkSending(false);
    setAgBulkProgress("");
    setAgSelectedIds(new Set());
    fetchCompanies();
    alert("Bulk sending process completed! Check individual statuses.");
  };

  const filteredCompanies = companies.filter(co => {
    const s = agSearchTerm.toLowerCase();
    const matchSearch = (co.name || "").toLowerCase().includes(s) || (co.email || "").toLowerCase().includes(s);

    const matchStatus = agFilterStatus === 'All' || co.status === agFilterStatus;

    // Date Filter
    let matchDate = true;
    if (agFromDate || agToDate) {
      // Prioritize joining_date (Date of Agreement)
      const dateVal = co.joining_date;
      const d = dateVal ? new Date(dateVal) : null;

      if (d && !isNaN(d.getTime())) {
        if (agFromDate) {
          const start = new Date(agFromDate);
          start.setHours(0, 0, 0, 0);
          if (d < start) matchDate = false;
        }
        if (agToDate) {
          const end = new Date(agToDate);
          end.setHours(23, 59, 59, 999);
          if (d > end) matchDate = false;
        }
      } else {
        matchDate = false;
      }
    }

    return matchSearch && matchStatus && matchDate;
  });

  const agStats = {
    total: companies.length,
    sent: companies.filter(e => e.status === 'Agreement Sent').length,
    pending: companies.filter(e => e.status === 'Pending' || !e.status).length
  };

  // ────────── RENDER HELPERS ──────────
  const selectedBg = theme === 'dark' ? 'rgba(56, 189, 248, 0.1)' : 'var(--accent-soft)';

  return (
    <div className="container" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* THEME TOGGLE */}
      <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1100 }}>
        <button onClick={toggleTheme} style={{ padding: '8px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', boxShadow: 'var(--card-shadow)', display: 'flex' }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* HEADER */}
      <header style={{ marginBottom: '2rem', textAlign: 'center', paddingTop: '1rem' }}>
        <h1 style={{ fontWeight: 800, color: 'var(--accent-color)', marginBottom: '0.25rem', letterSpacing: '-0.025em' }}>TalentScribe</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Professional Document Automation</p>
      </header>

      {/* TAB SWITCHER */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <div className="tab-switcher" style={{ display: 'inline-flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          {[
            { key: 'offer', label: 'Offer Letters', icon: <FileText size={18} /> },
            { key: 'agreement', label: 'Agreements', icon: <Handshake size={18} /> }
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: activeTab === tab.key ? 'var(--accent-color)' : 'transparent', color: activeTab === tab.key ? 'white' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'offer' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* STATS */}
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            {[
              { label: 'Total', val: offerStats.total, color: 'var(--accent-color)', icon: <Users size={16} /> },
              { label: 'Sent', val: offerStats.sent, color: 'var(--accent-color)', icon: <Send size={16} /> },
              { label: 'Accepted', val: offerStats.accepted, color: 'var(--success-text)', icon: <CheckCircle size={16} /> },
              { label: 'Rejected', val: offerStats.rejected, color: 'var(--error-text)', icon: <XCircle size={16} /> },
              { label: 'Pending', val: offerStats.pending, color: 'var(--pending-text)', icon: <Clock size={16} /> }
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ color: s.color, marginBottom: '0.25rem' }}>{s.icon}</div>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</h3>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{s.val}</p>
              </div>
            ))}
          </div>

          {/* TOOLBAR */}
          <div className="toolbar-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2rem', padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div className="toolbar-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px' }}>
                {['All', 'Pending', 'Offer Sent', 'Accepted', 'Rejected'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: filterStatus === s ? 'var(--card-bg)' : 'transparent', color: filterStatus === s ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>{s}</button>
                ))}
              </div>
              <div className="hide-mobile" style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 8px' }} />
              <div className="hide-mobile" style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px' }}>
                <button onClick={() => setViewMode('grid')} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: viewMode === 'grid' ? 'var(--card-bg)' : 'transparent', color: viewMode === 'grid' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}><LayoutGrid size={18} /></button>
                <button onClick={() => setViewMode('list')} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: viewMode === 'list' ? 'var(--card-bg)' : 'transparent', color: viewMode === 'list' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}><List size={18} /></button>
              </div>
            </div>

            <div className="toolbar-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ padding: '6px 8px 6px 28px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', outline: 'none', width: '100px', fontSize: '0.75rem' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-tertiary)', padding: '4px 6px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.7rem', color: 'var(--text-primary)', outline: 'none', width: '90px' }} title="From Date" />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>-</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.7rem', color: 'var(--text-primary)', outline: 'none', width: '90px' }} title="To Date" />
                {(fromDate || toDate) && <button onClick={() => { setFromDate(''); setToDate(''); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error-text)', padding: '0' }}><XCircle size={12} /></button>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-tertiary)', padding: '4px 6px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={toggleAllSelection}>
                <input
                  type="checkbox"
                  checked={filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id))}
                  onChange={() => { }}
                  style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select</span>
              </div>

              {selectedIds.size > 0 && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 750, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
                >
                  <Send size={16} /> Bulk Send ({selectedIds.size})
                </button>
              )}

              <button onClick={() => { setSelectedEmployeeForEdit(null); setIsModalOpen(true); }} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><Plus size={14} /> New</button>
              <button
                onClick={() => window.open(`${API_URL}/employees/template`)}
                style={{ border: '1px solid var(--success-text)', background: 'transparent', color: 'var(--success-text)', padding: '8px 12px', borderRadius: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                title="Download Excel Template"
              >
                <Download size={16} />
              </button>
              <button onClick={() => document.getElementById('importFile').click()} style={{ background: 'var(--success-text)', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><Upload size={14} /> Import</button>
              <input type="file" id="importFile" style={{ display: 'none' }} onChange={async e => {
                const fd = new FormData(); fd.append('file', e.target.files[0]);
                await fetch(`${API_URL}/employees/upload`, { method: 'POST', body: fd });
                fetchEmployees();
              }} />
            </div>
          </div>

          {/* CONTENT AREA */}
          {filteredEmployees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-tertiary)', borderRadius: '24px', border: '2px dashed var(--border-color)', color: 'var(--text-muted)' }}>
              No employees found matching your filters.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="responsive-grid">
              {filteredEmployees.map(emp => (
                <div key={emp.id} style={{
                  background: selectedIds.has(emp.id) ? selectedBg : 'var(--card-bg)',
                  padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                  boxShadow: 'var(--card-shadow)', position: 'relative', display: 'flex', flexDirection: 'column',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  minHeight: '160px'
                }} onClick={(e) => {
                  if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'svg' && e.target.tagName !== 'path' && e.target.tagName !== 'INPUT') {
                    const s = new Set(selectedIds); s.has(emp.id) ? s.delete(emp.id) : s.add(emp.id); setSelectedIds(s);
                  }
                }}>
                  <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '4px' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleViewEmployee(emp); }} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} title="View"><Eye size={16} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleEditEmployee(emp); }} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} title="Edit"><Pencil size={16} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp.id); }} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error-text)' }} title="Delete"><Trash2 size={16} /></button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '1.25rem' }}>
                    <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => {
                      const s = new Set(selectedIds); s.has(emp.id) ? s.delete(emp.id) : s.add(emp.id); setSelectedIds(s);
                    }} style={{ cursor: 'pointer', marginTop: '4px' }} onClick={e => e.stopPropagation()} />
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '60px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>{emp.name || "Unnamed"}</h3>
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> {(emp.created_at || emp.joining_date) ? new Date(emp.created_at || emp.joining_date).toLocaleDateString() : 'N/A'}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {emp.status && (
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '4px 8px', borderRadius: '6px',
                            background: emp.status === 'Accepted' ? 'var(--success-bg)' : emp.status === 'Rejected' ? 'var(--error-bg)' : 'var(--pending-bg)',
                            color: emp.status === 'Accepted' ? 'var(--success-text)' : emp.status === 'Rejected' ? 'var(--error-text)' : 'var(--pending-text)'
                          }}>
                            {emp.status}
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); }}
                          style={{
                            background: emp.status === 'Accepted' ? 'var(--success-text)' : 'var(--accent-color)',
                            color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px',
                            fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
                            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
                          }}
                        >
                          {emp.status?.includes('Sent') ? 'VIEW' : 'MANAGE'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                  <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                    <tr>
                      <th style={{ padding: '1rem', width: '48px', textAlign: 'center' }}>
                        <input type="checkbox" checked={filteredEmployees.length > 0 && filteredEmployees.every(e => selectedIds.has(e.id))} onChange={toggleAllSelection} style={{ cursor: 'pointer' }} />
                      </th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Designation</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map(emp => (
                      <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-color)', background: selectedIds.has(emp.id) ? selectedBg : 'transparent', transition: 'background 0.2s' }}>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => { const s = new Set(selectedIds); s.has(emp.id) ? s.delete(emp.id) : s.add(emp.id); setSelectedIds(s); }} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 750, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{emp.name || "Unnamed"}</div>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{emp.designation || "N/A"}</td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>{(emp.created_at || emp.joining_date) ? new Date(emp.created_at || emp.joining_date).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '6px',
                            background: emp.status === 'Accepted' ? 'var(--success-bg)' : emp.status === 'Rejected' ? 'var(--error-bg)' : 'var(--pending-bg)',
                            color: emp.status === 'Accepted' ? 'var(--success-text)' : emp.status === 'Rejected' ? 'var(--error-text)' : 'var(--pending-text)',
                            display: 'inline-block'
                          }}>
                            {emp.status || 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button onClick={() => setSelectedEmployee(emp)} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>MANAGE</button>
                            <button onClick={() => handleViewEmployee(emp)} style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} title="View"><Eye size={16} /></button>
                            <button onClick={() => handleEditEmployee(emp)} style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} title="Edit"><Pencil size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* AGREEMENT TAB CONTENT */}
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Companies', val: agStats.total, color: 'var(--accent-color)', icon: <Handshake size={16} /> },
              { label: 'Sent', val: agStats.sent, color: 'var(--accent-color)', icon: <Send size={16} /> },
              { label: 'Pending', val: agStats.pending, color: 'var(--pending-text)', icon: <Clock size={16} /> }
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ color: s.color, marginBottom: '0.25rem' }}>{s.icon}</div>
                <h3 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</h3>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{s.val}</p>
              </div>
            ))}
          </div>

          {/* TOOLBAR */}
          <div className="toolbar-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2rem', padding: '0.4rem 0.6rem', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div className="toolbar-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px' }}>
                {['All', 'Pending', 'Agreement Sent'].map(s => (
                  <button key={s} onClick={() => setAgFilterStatus(s)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', background: agFilterStatus === s ? 'var(--card-bg)' : 'transparent', color: agFilterStatus === s ? 'var(--accent-color)' : 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>{s}</button>
                ))}
              </div>
              <div className="hide-mobile" style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 8px' }} />
              <div className="hide-mobile" style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px' }}>
                <button onClick={() => setAgViewMode('grid')} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: agViewMode === 'grid' ? 'var(--card-bg)' : 'transparent', color: agViewMode === 'grid' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}><LayoutGrid size={18} /></button>
                <button onClick={() => setAgViewMode('list')} style={{ padding: '6px', borderRadius: '8px', border: 'none', background: agViewMode === 'list' ? 'var(--card-bg)' : 'transparent', color: agViewMode === 'list' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}><List size={18} /></button>
              </div>
            </div>

            <div className="toolbar-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                <input type="text" placeholder="Search..." value={agSearchTerm} onChange={e => setAgSearchTerm(e.target.value)} style={{ padding: '6px 8px 6px 28px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', outline: 'none', width: '100px', fontSize: '0.75rem' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-tertiary)', padding: '4px 6px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                <input type="date" value={agFromDate} onChange={e => setAgFromDate(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.7rem', color: 'var(--text-primary)', outline: 'none', width: '90px' }} title="From Date" />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>-</span>
                <input type="date" value={agToDate} onChange={e => setAgToDate(e.target.value)} style={{ background: 'transparent', border: 'none', fontSize: '0.7rem', color: 'var(--text-primary)', outline: 'none', width: '90px' }} title="To Date" />
                {(agFromDate || agToDate) && <button onClick={() => { setAgFromDate(''); setAgToDate(''); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error-text)', padding: '0' }}><XCircle size={12} /></button>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-tertiary)', padding: '4px 6px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={toggleAllAgSelection}>
                <input
                  type="checkbox"
                  checked={filteredCompanies.length > 0 && filteredCompanies.every(c => agSelectedIds.has(c.id))}
                  onChange={() => { }}
                  style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select</span>
              </div>

              {agSelectedIds.size > 0 && (
                <button
                  onClick={() => setShowAgBulkModal(true)}
                  style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '10px', fontWeight: 750, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
                >
                  <Send size={16} /> Bulk Send ({agSelectedIds.size})
                </button>
              )}

              <button onClick={() => { setSelectedCompanyForEdit(null); setIsCompanyModalOpen(true); }} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><Plus size={14} /> New Co</button>

              <button
                onClick={() => window.open(`${API_URL}/agreement-companies/template`)}
                style={{ border: '1px solid var(--success-text)', background: 'transparent', color: 'var(--success-text)', padding: '8px 12px', borderRadius: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                title="Download Excel Template"
              >
                <Download size={16} />
              </button>

              <button onClick={() => document.getElementById('agImportFile').click()} style={{ background: 'var(--success-text)', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '8px', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}><Upload size={14} /> Import</button>
              <input type="file" id="agImportFile" style={{ display: 'none' }} onChange={async e => {
                const fd = new FormData(); fd.append('file', e.target.files[0]);
                await fetch(`${API_URL}/agreement-companies/upload`, { method: 'POST', body: fd });
                fetchCompanies();
              }} />
            </div>
          </div>

          {/* CONTENT AREA */}
          {filteredCompanies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-tertiary)', borderRadius: '24px', border: '2px dashed var(--border-color)', color: 'var(--text-muted)' }}>
              No companies found matching your filters.
            </div>
          ) : agViewMode === 'grid' ? (
            <div className="responsive-grid">
              {filteredCompanies.map(co => (
                <div key={co.id} style={{
                  background: agSelectedIds.has(co.id) ? selectedBg : 'var(--card-bg)',
                  padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)',
                  boxShadow: 'var(--card-shadow)', position: 'relative', display: 'flex', flexDirection: 'column',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  minHeight: '160px'
                }} onClick={(e) => {
                  if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'svg' && e.target.tagName !== 'path' && e.target.tagName !== 'INPUT') {
                    const s = new Set(agSelectedIds); s.has(co.id) ? s.delete(co.id) : s.add(co.id); setAgSelectedIds(s);
                  }
                }}>
                  <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '4px' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleViewCompany(co); }} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} title="View"><Eye size={16} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleEditCompany(co); }} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} title="Edit"><Pencil size={16} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCompany(co.id); }} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--error-text)' }} title="Delete"><Trash2 size={16} /></button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '1rem' }}>
                    <input type="checkbox" checked={agSelectedIds.has(co.id)} onChange={() => {
                      const s = new Set(agSelectedIds); s.has(co.id) ? s.delete(co.id) : s.add(co.id); setAgSelectedIds(s);
                    }} style={{ cursor: 'pointer', marginTop: '4px' }} onClick={e => e.stopPropagation()} />
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '60px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.25 }}>{co.name || "Unnamed Entity"}</h3>
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }} title="Agreement Date">
                      <Calendar size={12} /> {co.joining_date ? new Date(co.joining_date).toLocaleDateString() : 'N/A'}
                    </div>
                    <div style={{
                      flex: 1, background: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: '8px',
                      fontSize: '0.65rem', fontWeight: 800, color: co.status === 'Agreement Sent' ? 'var(--success-text)' : 'var(--pending-text)',
                      textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {co.status || 'PENDING'}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedCompany(co); }}
                      style={{
                        flex: 2, background: 'var(--accent-color)', color: 'white', border: 'none',
                        padding: '10px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer',
                        fontSize: '0.8rem', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
                      }}
                    >
                      MANAGE AGREEMENT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                  <thead style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                    <tr>
                      <th style={{ padding: '1rem', width: '48px', textAlign: 'center' }}>
                        <input type="checkbox" checked={filteredCompanies.length > 0 && filteredCompanies.every(c => agSelectedIds.has(c.id))} onChange={toggleAllAgSelection} style={{ cursor: 'pointer' }} />
                      </th>
                      <th style={{ padding: '1.25rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company Name</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Contact</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                      <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                      <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map(co => (
                      <tr key={co.id} style={{ borderBottom: '1px solid var(--border-color)', background: agSelectedIds.has(co.id) ? selectedBg : 'transparent', transition: 'background 0.2s' }}>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <input type="checkbox" checked={agSelectedIds.has(co.id)} onChange={() => { const s = new Set(agSelectedIds); s.has(co.id) ? s.delete(co.id) : s.add(co.id); setAgSelectedIds(s); }} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 750, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{co.name || "Unnamed"}</div>
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{co.email || "N/A"}</td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>{co.joining_date ? new Date(co.joining_date).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '6px',
                            background: co.status === 'Agreement Sent' ? 'var(--success-bg)' : 'var(--pending-bg)',
                            color: co.status === 'Agreement Sent' ? 'var(--success-text)' : 'var(--pending-text)',
                            display: 'inline-block'
                          }}>
                            {co.status || 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button onClick={() => setSelectedCompany(co)} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>MANAGE</button>
                            <button onClick={() => handleViewCompany(co)} style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} title="View"><Eye size={16} /></button>
                            <button onClick={() => handleEditCompany(co)} style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} title="Edit"><Pencil size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {isModalOpen && <AddEmployeeModal onClose={() => setIsModalOpen(false)} onSave={handleSaveEmployee} initialData={selectedEmployeeForEdit} isViewOnly={isEmployeeViewOnly} />}
        {selectedEmployee && <LetterModal employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} onSuccess={() => { setSelectedEmployee(null); fetchEmployees(); }} />}

        {isCompanyModalOpen && <AddCompanyModal onClose={() => setIsCompanyModalOpen(false)} onSave={handleSaveCompany} initialData={selectedCompanyForEdit} isViewOnly={isAgViewOnly} />}
        {selectedCompany && <AgreementLetterModal employee={selectedCompany} onClose={() => setSelectedCompany(null)} onSuccess={() => { setSelectedCompany(null); fetchCompanies(); }} />}

        {showBulkModal && <BulkSendModal selectedCount={selectedIds.size} onClose={() => setShowBulkModal(false)} onStart={handleBulkSendOffer} />}
        {showAgBulkModal && <AgreementBulkSendModal selectedCount={agSelectedIds.size} onClose={() => setShowAgBulkModal(false)} onConfirm={handleBulkSendAgreements} />}

        {(isBulkSending || isAgBulkSending) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}
          >
            <div style={{ width: '80px', height: '80px', border: '4px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '2rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>🚀 Dispatched In Progress</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', fontWeight: 600 }}>{bulkProgress || agBulkProgress}</p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default App;
