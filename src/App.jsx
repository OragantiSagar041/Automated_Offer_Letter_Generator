import { useState, useEffect } from 'react';
import AddEmployeeModal from './components/AddEmployeeModal';
import LetterModal from './components/LetterModal';
import { generatePDFDoc } from './utils/pdfGenerator';
import jsPDF from 'jspdf';

// Local Development API URL
const API_URL = 'http://127.0.0.1:8000';

function App() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All'); // 'All', 'Pending', 'Offer Sent'

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [importMsg, setImportMsg] = useState(null); // Result message

  const fetchEmployees = () => {
    // ... (existing)
    setLoading(true);
    fetch(`${API_URL}/employees/`)
      .then(res => res.json())
      .then(data => {
        setEmployees(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch backend:", err);
        setLoading(false);
      });
  };
  // ...


  useEffect(() => {
    fetchEmployees();
  }, []);

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
          setSelectedEmployeeForEdit(null); // Clear edit state
          fetchEmployees(); // Refresh list
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
        // 1. Generate Letter Content
        const genRes = await fetch(`${API_URL}/letters/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: emp.id,
            letter_type: "Offer Letter", // Default to Offer Letter for Bulk
            tone: "Professional"
          })
        });
        const genData = await genRes.json();
        const content = genData.content;

        // 2. Generate PDF
        const doc = await generatePDFDoc(content);
        const pdfBase64 = doc.output('datauristring');

        // 3. Send Email
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

      } catch (err) {
        console.error(`Failed for ${emp.name}`, err);
      }
    }

    setIsBulkSending(false);
    setBulkProgress("");
    alert(`Bulk Send Complete! Sent ${successCount}/${ids.length} emails.`);
    setSelectedIds(new Set()); // Clear selection
    fetchEmployees(); // Refresh statuses
  };

  // --- Derived State for Stats & Search ---
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
    <div className="container" style={{ padding: '2rem', maxWidth: '98vw', margin: '0 auto' }}>

      {/* BULK PROGRESS OVERLAY */}
      {isBulkSending && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white'
        }}>
          <h2>🚀 Bulk Sending in Progress...</h2>
          <p style={{ fontSize: '1.5rem' }}>{bulkProgress}</p>
          <div style={{ marginTop: '1rem', width: '300px', height: '10px', background: '#334155', borderRadius: '5px' }}>
            <div style={{
              width: `${(selectedIds.size > 0 ? (parseInt(bulkProgress.match(/\d+/)) / selectedIds.size) * 100 : 0)}%`,
              height: '100%', background: '#34d399', borderRadius: '5px', transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}

      <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
        <img
          src="/arah_logo.jpg"
          alt="Arah Infotech Logo"
          style={{ height: '120px', marginBottom: '1.5rem', borderRadius: '12px' }}
        />
        <h1 style={{ fontSize: '4rem', marginBottom: '0.8rem', fontWeight: 800 }}>Arah Infotech - Admin Portal (v2)</h1>
        <p style={{ color: '#94a3b8', fontSize: '1.4rem', letterSpacing: '1px' }}>ENTERPRISE OFFER MANAGEMENT & PAYROLL AUTOMATION</p>
      </header>

      <div style={{ maxWidth: '95vw', margin: '0 auto' }}>

        {/* --- Quick Stats Cards --- */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', border: '1px solid #334155', textAlign: 'center' }}>
            <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '1.2rem' }}>Total Candidates</h3>
            <p style={{ margin: '1rem 0 0', fontSize: '3.5rem', fontWeight: 'bold', color: 'white' }}>{stats.total}</p>
          </div>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', border: '1px solid #065f46', textAlign: 'center' }}>
            <h3 style={{ margin: 0, color: '#34d399', fontSize: '1.2rem' }}>Offers Sent</h3>
            <p style={{ margin: '1rem 0 0', fontSize: '3.5rem', fontWeight: 'bold', color: '#34d399' }}>{stats.sent}</p>
          </div>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '16px', border: '1px solid #334155', textAlign: 'center' }}>
            <h3 style={{ margin: 0, color: '#facc15', fontSize: '1.2rem' }}>Pending Action</h3>
            <p style={{ margin: '1rem 0 0', fontSize: '3.5rem', fontWeight: 'bold', color: '#facc15' }}>{stats.pending}</p>
          </div>
        </div>

        {/* --- Toolbar: Search + Add + TABS --- */}
        <div style={{ marginBottom: '2rem' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
            {['All', 'Pending', 'Offer Sent'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: filterStatus === status ? '3px solid #646cff' : '3px solid transparent',
                  color: filterStatus === status ? '#fff' : '#94a3b8',
                  fontSize: '1.2rem',
                  fontWeight: filterStatus === status ? 'bold' : 'normal',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {status}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '2.5rem', margin: 0, textAlign: 'center' }}>Employee Directory</h2>

            {/* BULK ACTION BUTTON */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkSend}
                style={{
                  background: '#e11d48', color: 'white', border: 'none',
                  padding: '14px 28px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem',
                  cursor: 'pointer', boxShadow: '0 4px 10px rgba(225, 29, 72, 0.4)',
                  animation: 'pulse 2s infinite'
                }}
              >
                🚀 Send Offers to ({selectedIds.size}) Candidates
              </button>
            )}

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Search by name, role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '14px 20px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  background: '#0f172a',
                  color: 'white',
                  fontSize: '1.1rem',
                  width: '300px'
                }}
              />
              <button
                onClick={() => {
                  setSelectedEmployeeForEdit(null); // Clear any previous edit state
                  setIsModalOpen(true);
                }}
                style={{
                  background: '#646cff',
                  color: 'white',
                  border: 'none',
                  padding: '14px 28px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                + Add Employee
              </button>

              <input
                type="file"
                id="importInput"
                style={{ display: 'none' }}
                accept=".csv, .xlsx"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  const formData = new FormData();
                  formData.append('file', file);
                  setImportMsg("Uploading " + file.name + "...");

                  try {
                    const res = await fetch(`${API_URL}/employees/upload`, {
                      method: 'POST',
                      body: formData
                    });
                    const data = await res.json();
                    if (res.ok) {
                      if (data.errors.length > 0) {
                        setImportMsg(`⚠️ Partial/Failed Import:\nAdded: ${data.imported_count}\n\nFAILED ROWS:\n${data.errors.length > 15 ? data.errors.slice(0, 15).join('\n') + '\n...' : data.errors.join('\n')}`);
                      } else {
                        setImportMsg(`✅ Success! Added: ${data.imported_count} employees.`);
                      }
                      fetchEmployees();
                    } else {
                      setImportMsg(`❌ Failed: ${data.detail}`);
                    }
                  } catch (err) {
                    setImportMsg(`❌ Net Error: ${err.message}`);
                  }
                  e.target.value = null; // Reset
                }}
              />
              <button
                onClick={() => document.getElementById('importInput').click()}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '14px 28px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                📁 Import Excel
              </button>
            </div>
            {importMsg && (
              <div style={{ width: '100%', textAlign: 'center', padding: '10px', background: '#334155', borderRadius: '8px', color: '#facc15', marginTop: '10px', whiteSpace: 'pre-wrap' }}>
                {importMsg}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', fontSize: '1.2rem' }}>Loading backend data...</p>
        ) : filteredEmployees.length === 0 ? (
          <div style={{
            background: '#1e293b',
            padding: '4rem',
            borderRadius: '16px',
            textAlign: 'center',
            border: '1px solid #334155'
          }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              {employees.length === 0 ? "No employees found in database." : "No matches found for your search."}
            </p>
            {employees.length === 0 && (
              <p style={{ fontSize: '1.1rem', color: '#94a3b8' }}>
                (Click the button above to add one!)
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {filteredEmployees.map(emp => (
              <div key={emp.id} style={{
                background: selectedIds.has(emp.id) ? '#334155' : '#1e293b', // Highlight Selection
                padding: '2rem',
                borderRadius: '12px',
                border: '1px solid #334155',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                transition: 'background 0.2s'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

                      {/* CHECKBOX */}
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggleSelection(emp.id)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#646cff' }}
                      />

                      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>{emp.name}</h3>
                      {emp.status === 'Offer Sent' && (
                        <span style={{
                          background: '#064e3b', color: '#34d399',
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'
                        }}>
                          ✅ Sent
                        </span>
                      )}
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleEditEmployee(emp)}
                        style={{
                          background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '1.2rem', padding: '5px'
                        }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp.id)}
                        style={{
                          background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: '5px'
                        }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: '1rem' }}>
                    {emp.designation} <br /> <span style={{ opacity: 0.7 }}>{emp.department}</span>
                  </p>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                  <button
                    onClick={() => setSelectedEmployee(emp)}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: '2px solid #646cff',
                      color: '#646cff',
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.target.style.background = 'rgba(100, 108, 255, 0.1)'}
                    onMouseOut={e => e.target.style.background = 'transparent'}
                  >
                    {emp.status === 'Offer Sent' ? 'View / Resend Letter' : 'Generate Letter'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {
        isModalOpen && (
          <AddEmployeeModal
            onClose={() => {
              setIsModalOpen(false);
              setSelectedEmployeeForEdit(null);
            }}
            onSave={handleSaveEmployee}
            initialData={selectedEmployeeForEdit}
          />
        )
      }

      {
        selectedEmployee && (
          <LetterModal
            employee={selectedEmployee}
            onClose={() => setSelectedEmployee(null)}
            onSuccess={() => {
              setSelectedEmployee(null); // Close modal
              fetchEmployees(); // Refresh list to show new badge
            }}
          />
        )
      }
    </div >
  );
}

export default App;
