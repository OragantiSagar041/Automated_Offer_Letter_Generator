import { useState, useEffect } from 'react';
import AddEmployeeModal from './components/AddEmployeeModal';
import LetterModal from './components/LetterModal';

function App() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchEmployees = () => {
    setLoading(true);
    fetch('http://127.0.0.1:8000/employees/')
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

  // Fetch employees from our FastAPI Backend
  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleSaveEmployee = (employeeData) => {
    const isEdit = !!selectedEmployeeForEdit;
    const url = isEdit
      ? `http://127.0.0.1:8000/employees/${selectedEmployeeForEdit.id}`
      : 'http://127.0.0.1:8000/employees/';
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
            // Pydantic validation errors are arrays, others are strings
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
      const res = await fetch(`http://127.0.0.1:8000/employees/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchEmployees();
      } else {
        alert("Failed to delete.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // --- Derived State for Stats & Search ---
  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: employees.length,
    sent: employees.filter(e => e.status === 'Offer Sent').length,
    pending: employees.length - employees.filter(e => e.status === 'Offer Sent').length
  };

  return (
    <div className="container" style={{ padding: '2rem', maxWidth: '98vw', margin: '0 auto' }}>
      <header style={{ marginBottom: '4rem', textAlign: 'center' }}>
        <img
          src="/arah_logo.jpg"
          alt="Arah Infotech Logo"
          style={{ height: '120px', marginBottom: '1.5rem', borderRadius: '12px' }}
        />
        <h1 style={{ fontSize: '4rem', marginBottom: '0.8rem', fontWeight: 800 }}>Arah Infotech - Admin Portal</h1>
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

        {/* --- Toolbar: Search + Add --- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>Employee Directory</h2>

          <div style={{ display: 'flex', gap: '1rem', flex: 1, justifyContent: 'flex-end' }}>
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
                background: '#1e293b',
                padding: '2rem',
                borderRadius: '12px',
                border: '1px solid #334155',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>{emp.name}</h3>
                      {emp.status === 'Offer Sent' && (
                        <span style={{
                          background: '#064e3b', color: '#34d399',
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'
                        }}>
                          ✅ Offer Sent
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

      {isModalOpen && (
        <AddEmployeeModal
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEmployeeForEdit(null);
          }}
          onSave={handleSaveEmployee}
          initialData={selectedEmployeeForEdit}
        />
      )}

      {selectedEmployee && (
        <LetterModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onSuccess={() => {
            setSelectedEmployee(null); // Close modal
            fetchEmployees(); // Refresh list to show new badge
          }}
        />
      )}
    </div>
  );
}

export default App;
