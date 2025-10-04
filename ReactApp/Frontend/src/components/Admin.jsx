import React, { useState, useEffect } from 'react';
// Import onSnapshot for real-time updates
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../Firebase"; // Assuming Firebase.js is in the ../Firebase directory

// --- Configuration ---
const API_BASE_URL = "https://counterfeit-detection-1.onrender.com";

// --- Main Admin Dashboard Component ---
export default function AdminDashboard({ user, onLogout }) {
  const [activeSection, setActiveSection] = useState('dashboard');
  
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [totals, setTotals] = useState({ batches: 0, products: 0, qcSubmissions: 0 });
  const [loading, setLoading] = useState({ users: true, totals: true, reports: true });
  const [error, setError] = useState({ users: null, totals: null, reports: null });

  // --- Data Fetching Hooks ---

  // Listen for real-time user updates from Firestore
  useEffect(() => {
    const usersCollection = collection(db, "users");
    const unsubscribe = onSnapshot(usersCollection, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(items);
      setLoading(prev => ({ ...prev, users: false }));
    }, (err) => {
      console.error("Error fetching users in real-time:", err);
      setError(prev => ({ ...prev, users: "Failed to fetch users." }));
      setLoading(prev => ({ ...prev, users: false }));
    });
    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  // Fetch totals from FastAPI (this remains a one-time fetch)
  useEffect(() => {
    const fetchTotals = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/view_totals`);
        if (!response.ok) throw new Error("Network response was not ok.");
        const data = await response.json();
        setTotals({
          batches: data.totalBatches ?? data.total_batches ?? 0,
          products: data.totalProducts ?? data.total_products ?? 0,
          qcSubmissions: data.totalQCSubmissions ?? data.total_qc_submissions ?? 0,
        });
      } catch (err)
      {
        console.error("Error fetching totals:", err);
        setError(prev => ({ ...prev, totals: "Failed to fetch totals." }));
      } finally {
        setLoading(prev => ({ ...prev, totals: false }));
      }
    };
    fetchTotals();
  }, []);

  // Listen for real-time report updates from Firestore
  useEffect(() => {
    const reportsCollection = collection(db, "reports");
    const unsubscribe = onSnapshot(reportsCollection, (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setReports(items);
        setLoading(prev => ({ ...prev, reports: false }));
    }, (err) => {
        console.error("Error fetching reports in real-time:", err);
        setError(prev => ({ ...prev, reports: "Failed to fetch reports." }));
        setLoading(prev => ({ ...prev, reports: false }));
    });
    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);


  // --- User and Report Management Functions ---

  const handleUserStatusUpdate = async (id, status) => {
    try {
      await updateDoc(doc(db, "users", id), { status });
      // No need to manually update state here, onSnapshot will do it automatically
    } catch (err) {
        console.error(`Error updating user status to ${status}:`, err);
    }
  };
  
  const approveUser = (id) => handleUserStatusUpdate(id, "approved");
  const rejectUser = (id) => handleUserStatusUpdate(id, "rejected");

  const approveReport = async (reportId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/approve_report/${reportId}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error("Failed to approve report.");
      // onSnapshot will handle the state update
    } catch (err) {
      console.error("Error approving report:", err);
    }
  };

  const deleteReport = async (reportId) => {
    if (window.confirm("Are you sure you want to delete this report?")) {
      try {
        const response = await fetch(`${API_BASE_URL}/delete_report/${reportId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error("Failed to delete report.");
        // onSnapshot will handle the state update
      } catch (err) {
        console.error("Error deleting report:", err);
      }
    }
  };


  // --- Derived State ---
  const pendingUsers = users.filter(u => u.status === 'pending');
  const manufacturerCount = users.filter(u => u.role === "Manufacturer").length;
  const partners = users.filter(u => u.role === 'Manufacturer' || u.role === 'QCUploader');
  const pendingReportsCount = reports.filter(r => r.status === 'pending').length;


  // Renders the currently selected section with appropriate props
  const ActiveSection = () => {
    switch (activeSection) {
      case 'partners':
        return <Partners partners={partners} approveUser={approveUser} rejectUser={rejectUser} loading={loading.users} />;
      case 'reports':
        return (
          <Reports 
            reports={reports} 
            loading={loading.reports}
            approveReport={approveReport}
            deleteReport={deleteReport}
          />
        );
      case 'qc':
        return <Qc qcSubmissions={totals.qcSubmissions} loading={loading.totals} />;
      case 'dashboard':
      default:
        return (
          <Dashboard
            stats={{
              products: totals.products,
              manufacturers: manufacturerCount,
              batches: totals.batches,
              pending: pendingUsers.length,
            }}
            loading={loading.totals || loading.users || loading.reports}
            alerts={{ pending: pendingUsers.length, newReports: pendingReportsCount }}
          />
        );
    }
  };

  return (
    <>
      <style>{`
        /* --- STYLES --- */
        @font-face {
            font-family: 'Mozilla Headline';
            src: url('/static/MozillaHeadline-Regular.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
        }
        @font-face {
            font-family: 'Mozilla Headline';
            src: url('/static/MozillaHeadline-Bold.ttf') format('truetype');
            font-weight: bold;
            font-style: normal;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Mozilla Headline', sans-serif; }
        body {
            color: #ecf0f1; display: flex; justify-content: center;
            background: linear-gradient(-45deg, #0b0c10, #1f2833, #157272, #0b0c10);
            background-size: 400% 400%; animation: animated-background 25s ease infinite; overflow-x: hidden;
        }
        .pills-animation-container {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            overflow: hidden; z-index: 0; pointer-events: none;
        }
        .pill {
            position: absolute; display: block; width: 15px; height: 35px; border-radius: 20px;
            background-color: rgba(102, 252, 241, 0.15); bottom: -150px; animation: move-diagonally linear infinite;
        }
        .pill::before {
            content: ''; position: absolute; width: 100%; height: 50%;
            background-color: rgba(236, 240, 241, 0.15); border-top-left-radius: 20px; border-top-right-radius: 20px;
        }
        .pill:nth-child(1) { left: 10%; animation-duration: 15s; animation-delay: 0s; --scale: 0.8; }
        .pill:nth-child(2) { left: 20%; animation-duration: 12s; animation-delay: -5s; --scale: 1.0; }
        .pill:nth-child(3) { left: 30%; animation-duration: 18s; animation-delay: -2s; --scale: 0.7; }
        .pill:nth-child(4) { left: 40%; animation-duration: 10s; animation-delay: -8s; --scale: 1.1; }
        .pill:nth-child(5) { left: 50%; animation-duration: 16s; animation-delay: -1s; --scale: 0.9; }
        .pill:nth-child(6) { left: 60%; animation-duration: 11s; animation-delay: -6s; --scale: 0.8; }
        .pill:nth-child(7) { left: 70%; animation-duration: 14s; animation-delay: -3s; --scale: 1.0; }
        .pill:nth-child(8) { left: 80%; animation-duration: 19s; animation-delay: -7s; --scale: 0.7; }
        .pill:nth-child(9) { left: 90%; animation-duration: 13s; animation-delay: -4s; --scale: 1.2; }
        .pill:nth-child(10) { left: 5%; animation-duration: 17s; animation-delay: -9s; --scale: 0.9; }
        .top-navbar {
            position: fixed; top: 0; left: 0; width: 100%; background: transparent;
            border-bottom: 1px solid rgba(102, 252, 241, 0.2); z-index: 1000;
            display: flex; justify-content: space-between; align-items: center; padding: 15px 30px;
        }
        .nav-logo { font-size: 1.5rem; font-weight: bold; color: white; }
        .nav-links { list-style: none; display: flex; gap: 30px; position: absolute; left: 50%; transform: translateX(-50%); }
        .nav-item { color: #ccc; text-decoration: none; font-weight: 600; position: relative; transition: all 0.3s ease; cursor: pointer; }
        .nav-item::after { content: ''; position: absolute; width: 0; height: 2px; background: #66fcf1; bottom: -5px; left: 50%; transform: translateX(-50%); transition: width 0.3s ease; }
        .nav-item:hover { color: white; }
        .nav-item.active { color: white; }
        .nav-item:hover::after, .nav-item.active::after { width: 100%; }
        .nav-item.active::after { background: #66fcf1; }
        .profile-section { display: flex; align-items: center; gap: 12px; }
        .profile-icon { width: 40px; height: 40px; fill: #ecf0f1; }
        .profile-name { color: #ecf0f1; font-weight: 600; }
        .content-area { padding: 30px; max-width: 1200px; width: 100%; margin-top: 80px; }
        .section { display: block; }
        .user,.report,.qc{margin-top:-200px}
        .card { background: rgba(43, 43, 43, 0.7); backdrop-filter: blur(5px);border-radius: 12px; padding: 35px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); margin-bottom: 20px; color: #f1f1f1; border: 1px solid rgba(255, 255, 255, 0.1); width:1000px;height:400px}
        .card-title { font-size: 1.3rem; font-weight: 600; margin-bottom: 20px;padding-left:370px }
        .card-title-dashboard{ font-size: 1.3rem; font-weight: 600; margin-bottom: 20px;padding-left:290px}
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: rgba(51, 51, 51, 0.7); backdrop-filter: blur(5px); color: white; padding: 25px; border-radius: 12px; text-align: center; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); border: 1px solid rgba(255, 255, 255, 0.1); transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; }
        .summary-card:hover { transform: translateY(-5px); box-shadow: 0 8px 25px rgba(102, 252, 241, 0.2); border-color: rgba(102, 252, 241, 0.5); }
        .summary-card h3 { font-size: 2.2rem; margin-bottom: 10px; color: #66fcf1; }
        .summary-card p { font-size: 1rem; opacity: 0.9; }
        .alerts-container { margin-bottom: 30px; }
        .alert { padding: 15px 20px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; animation: slideIn 0.3s ease; background: rgba(51, 51, 51, 0.7); backdrop-filter: blur(5px); }
        .alert-warning { border-left: 4px solid #f1c40f; color: #f1f1f1; }
        .alert-info { border-left: 4px solid #3498db; color: #f1f1f1; }
        .alert-close { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: inherit; opacity: 0.7; }
        .alert-close:hover { opacity: 1; }
        .table-container { overflow-x: auto; max-height: 250px;}
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(51, 51, 51, 0.8); font-weight: 600; color: #f1f1f1; position: sticky; top: 0; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid rgba(135, 153, 166, 0.2); }
        tr:hover { background-color: #363636; }
        td.details-column { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .action-column { width: 1%; white-space: nowrap; text-align: right; }
        #users th, #users td, #qc th, #qc td { padding-left: 8px; padding-right: 8px; }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; margin: 2px; transition: all 0.3s ease; }
        .btn-logout { background: #c0392b; color: white; padding: 8px 12px; font-weight: 600;}
        .btn-logout:hover { background: #e74c3c; }
        .btn-success { background: #48bb78; color: white; }
        .btn-success:hover { background: #38a169; }
        .btn-danger { background: #f56565; color: white; }
        .btn-danger:hover { background: #e53e3e; }
        .btn-warning { background: #ed8936; color: white; }
        .btn-warning:hover { background: #dd6b20; }
        .status { padding: 4px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 500; text-transform: capitalize; }
        .status-approved { background: #4a5d4a; color: #c6f6d5; }
        .status-pending { background: #5d5d4a; color: #fef5e7; }
        .status-rejected { background: #5d4a4a; color: #fed7d7; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes animated-background { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes move-diagonally { from { transform: translateY(0) rotate(-45deg) scale(var(--scale, 1)); } to { transform: translateY(-120vh) rotate(-45deg) scale(var(--scale, 1)); } }
      `}</style>
      <PillsAnimation />
      <Navbar activeSection={activeSection} setActiveSection={setActiveSection} user={user} onLogout={onLogout} />
      <div className="content-area">
        <ActiveSection />
      </div>
    </>
  );
}

// --- Child Components ---

const PillsAnimation = () => (
  <div className="pills-animation-container">
    {[...Array(10)].map((_, i) => <div key={i} className="pill"></div>)}
  </div>
);

const Navbar = ({ activeSection, setActiveSection, user, onLogout }) => {
  const navItems = ['dashboard', 'partners', 'reports', 'qc'];
  return (
    <header className="top-navbar">
      <span className="nav-logo">Admin Panel</span>
      <ul className="nav-links">
        {navItems.map(item => (
          <li key={item}>
            <a className={`nav-item ${activeSection === item ? 'active' : ''}`} onClick={() => setActiveSection(item)}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </a>
          </li>
        ))}
      </ul>
      <div className="profile-section">
        <svg className="profile-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
        <span className="profile-name">{user?.email || 'Admin'}</span>
        <button className="btn btn-logout" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
};

const Dashboard = ({ stats, loading, alerts }) => {
  const closeAlert = (e) => e.currentTarget.parentElement.style.display = 'none';
  return (
    <section id="dashboard" className="section active dashboard">
      <h2 className="card-title-dashboard">Medicine Blockchain Security: Overview</h2>
      <div className="summary-grid">
        <div className="summary-card"><h3>{loading ? '...' : stats.products}</h3><p>Total Products</p></div>
        <div className="summary-card"><h3>{loading ? '...' : stats.manufacturers}</h3><p>Manufacturers</p></div>
        <div className="summary-card"><h3>{loading ? '...' : stats.batches}</h3><p>Total Batches</p></div>
        <div className="summary-card"><h3>{loading ? '...' : stats.pending}</h3><p>Pending Approvals</p></div>
      </div>
      <div className="alerts-container">
        {alerts.pending > 0 && (
            <div className="alert alert-warning"><span>{alerts.pending} partner approvals pending review</span><button className="alert-close" onClick={closeAlert}>×</button></div>
        )}
        {alerts.newReports > 0 && (
            <div className="alert alert-info"><span>{alerts.newReports} new counterfeit reports received</span><button className="alert-close" onClick={closeAlert}>×</button></div>
        )}
      </div>
      <div className="card">
        <h3 className="card-title">Data Overview</h3>
        <p>Detailed analytics and charts will be displayed here, providing insights into the supply chain security.</p>
      </div>
    </section>
  );
};

const Partners = ({ partners, approveUser, rejectUser, loading }) => (
  <section id="partners" className="section active user"> 
    <div className="card">
      <h2 className="card-title">Partner Management</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th className="action-column">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>Loading partners...</td></tr>
            ) : partners.length > 0 ? (
              partners.map(partner => (
                <tr key={partner.id}>
                  <td>{partner.companyName || 'N/A'}</td>
                  <td>{partner.email}</td>
                  <td>{partner.role}</td>
                  <td><span className={`status status-${partner.status}`}>{partner.status}</span></td>
                  <td className="action-column">
                    {partner.status === 'pending' ? (
                      <>
                        <button className="btn btn-success" onClick={() => approveUser(partner.id)}>Approve</button>
                        <button className="btn btn-danger" onClick={() => rejectUser(partner.id)}>Reject</button>
                      </>
                    ) : ( <span style={{ color: '#666' }}>No actions</span> )}
                  </td>
                </tr>
              ))
            ) : ( <tr><td colSpan="5" style={{ textAlign: 'center' }}>No partners found.</td></tr> )}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

const Reports = ({ reports, loading, approveReport, deleteReport }) => (
    <section id="reports" className="section active report">
      <div className="card">
        <h2 className="card-title">Report Management</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Product Hash</th>
                <th>Details</th>
                <th>Status</th>
                <th className="action-column">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>Loading reports...</td></tr>
              ) : reports.length > 0 ? (
                reports.map(report => (
                  <tr key={report.id}>
                    <td>{report.productHash.substring(0, 20)}...</td>
                    <td className="details-column" title={report.reportDetails}>{report.reportDetails}</td>
                    <td><span className={`status status-${(report.status || '').toLowerCase()}`}>{report.status}</span></td>
                    <td className="action-column">
                      {report.status === 'pending' && (
                          <button className="btn btn-success" onClick={() => approveReport(report.id)}>Approve</button>
                      )}
                      <button className="btn btn-danger" onClick={() => deleteReport(report.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No reports found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
  
const Qc = ({ qcSubmissions, loading }) => (
<section id="qc" className="section active qc">
    <div className="card">
    <h2 className="card-title">QC Management</h2>
    <div style={{textAlign: 'center', marginTop: '50px'}}>
        <h3>Total QC Submissions</h3>
        <p style={{fontSize: '3rem', color: '#66fcf1', fontWeight: 'bold'}}>{loading ? '...' : qcSubmissions}</p>
        <p>This data is fetched live from the FastAPI backend.</p>
    </div>
    </div>
</section>
);