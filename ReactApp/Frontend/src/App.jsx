import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { auth } from './Firebase';

// Import your page components
import AdminDashboard from './components/Admin'; 
import Register from './components/Register';
import QCUploader from './components/Qcuploader'; 
import ManufacturerPortal from './components/Manufacturer'; 

function AppWrapper() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // This is now a simple login handler that navigates immediately
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    const rolePath = userData.role.toLowerCase();
    navigate(`/${rolePath}`);
  };

  const handleLogout = () => {
    auth.signOut();
    setUser(null); // Explicitly clear the user state
    navigate('/login');
  };

  return (
    <div className="App">
      <Routes>
        {/* Register route is now simple */}
        <Route 
          path="/login" 
          element={<Register onLoginSuccess={handleLoginSuccess} />} 
        />
        
        {/* Protected Routes check for the user state */}
        <Route 
          path="/admin" 
          element={user && user.role === 'admin' ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/manufacturer" 
          element={user && user.role === 'Manufacturer' ? <ManufacturerPortal user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/qcuploader" 
          element={user && user.role === 'QCUploader' ? <QCUploader user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} 
        />
        
        {/* Default route now always goes to login if no user is set */}
        <Route 
          path="/" 
          element={<Navigate to="/login" />} 
        />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
}

export default App;