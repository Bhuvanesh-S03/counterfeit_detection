import React, { useState, useEffect } from 'react';

// --- Configuration ---
const API_BASE_URL = "https://counterfeit-detection-1.onrender.com"; // Replace with your FastAPI server IP

// --- Main Component for the QC Uploader Page ---
export default function QCUploader({ user, onLogout }) {
  // State for the list of submissions fetched from the API
  const [submissions, setSubmissions] = useState([]);
  // State for the currently selected file for upload
  const [selectedFile, setSelectedFile] = useState(null);
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Function to fetch all QC submissions from the backend
  const fetchSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/view_all_qc_submissions`);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      setSubmissions(data.qcSubmissions || []);
    } catch (err) {
      setError("Failed to fetch QC submissions.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when the component mounts
  useEffect(() => {
    fetchSubmissions();
  }, []);

  // Handler for when a user selects a file
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Handler for submitting the upload form
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert("Please select a CSV file to upload.");
      return;
    }
    setUploading(true);

    const formData = new FormData();
    formData.append('uploaderId', user.email); // Use user's email as the ID
    formData.append('uploadDate', new Date().toISOString());
    formData.append('qc_file', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/add_qc_submission`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Upload failed");
      }
      alert("File uploaded successfully!");
      document.getElementById('csv-input').value = null; 
      setSelectedFile(null); // Clear the file input
      fetchSubmissions(); // Refresh the list of submissions
    } catch (err) {
      alert(`Error: ${err.message}`);
      console.error(err);
    } finally {
      setUploading(false);
    }
  };
  
  // Handler to open the IPFS gateway URL for a submission
  const handleViewFile = (gatewayUrl) => {
    if (gatewayUrl) {
      window.open(gatewayUrl, '_blank');
    } else {
      alert("No viewable URL available for this submission.");
    }
  };

  return (
    <>
      <style>{`
        /* General Styles */
        @font-face { font-family: 'Mozilla Headline'; src: url('/static/MozillaHeadline-Regular.ttf') format('truetype'); }
        @font-face { font-family: 'Mozilla Headline'; src: url('/static/MozillaHeadline-Bold.ttf') format('truetype'); font-weight: bold; }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Mozilla Headline', sans-serif; }
        body {
            background: linear-gradient(-45deg, #0b0c10, #1f2833, #157272, #0b0c10);
            background-size: 400% 400%; animation: animated-background 25s ease infinite;
            color: #ecf0f1; min-height: 100vh; overflow-x: hidden;
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
        /* MODIFICATION: Changed wrapper to handle positioning */
        .qcuploader-wrapper {
            width: 100%;
            min-height: 100vh;
            padding-top: 100px; /* Creates space for the fixed header */
            padding-left: 20px;
            padding-right: 20px;
            padding-bottom: 20px;
            margin-left:300px
        }
        
        .portal-container {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto; /* Horizontally centers the container */
        }
        
        .header {
            position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
            background:linear-gradient(-45deg, #0b0c10, #1f2833, #157272, #0b0c10) backdrop-filter: blur(10px); padding: 15px 30px;
            box-shadow: 0 2px 10px  #115d5dff; display: flex;
            justify-content: space-between; align-items: center;
        }
        .header-title { font-size: 1.8rem; font-weight: 600; }
        .profile-section { display: flex; align-items: center; gap: 15px; }
        .profile-icon { width: 40px; height: 40px; fill: #ecf0f1; }
        .profile-name { font-weight: 600; display: block; }
        .btn-logout { background: #c0392b; color: white; padding: 8px 12px; font-weight: 600; border-radius: 6px; border: none; cursor: pointer; }
        .btn-logout:hover { background: #e74c3c; }
        
        .card {
            background: rgba(43, 43, 43, 0.7); padding: 30px; border-radius: 15px;
            margin-bottom: 30px; border: 1px solid rgba(255, 255, 255, 0.1);
            width: 100%; /* Make cards take full width of the portal-container */
        }
        .header-card{
            background: rgba(43, 43, 43, 0.7); padding: 30px; border-radius: 15px;
            margin-bottom: 30px; border: 1px solid rgba(255, 255, 255, 0.1);
            width: 50%;margin-left:240px; /* Make cards take full width of the portal-container */
        }
        .card-title { font-size: 1.5rem; font-weight: 600; color: #f1f1f1; margin-bottom: 20px; text-align: center; }
        
        .upload-form { display: flex; align-items: center; justify-content: center; gap: 20px; }
        .file-input-label { padding: 12px 20px; background: #444; color: white; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.3s ease; border: 2px dashed #666; }
        .file-input-label:hover { border-color: #66fcf1; }
        .file-input { display: none; }
        .file-name-display { color: #ccc; font-style: italic; }
        
        .table-container { max-height: 400px; overflow-y: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(51, 51, 51, 0.8); font-weight: 600; padding: 12px 15px; text-align: left; position: sticky; top: 0; }
        td { padding: 12px 15px; border-bottom: 1px solid rgba(135, 153, 166, 0.2); }
        tr:hover { background-color: #363636; }
        
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: all 0.3s ease; color: #1c1c1c; background: #f1f1f1; }
        .btn:disabled { background: #888; cursor: not-allowed; }
        .btn-primary { background: #f1f1f1; } .btn-primary:hover { background: #ccc; }
        .action-column { text-align: right; }
        .status { padding: 4px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 500; text-transform: capitalize; }
        .status-pass { background: #4a5d4a; color: #c6f6d5; }
        .status-fail { background: #5d4a4a; color: #fed7d7; }

        @keyframes animated-background { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes move-diagonally { from { transform: translateY(0) rotate(-45deg); } to { transform: translateY(-120vh) rotate(-45deg); } }
      `}</style>
      <div className="qcuploader-wrapper">
        <PillsAnimation />
        <Header user={user} onLogout={onLogout} />
        <div className="portal-container">
          <div className="header-card">
            <h2 className="card-title">Upload New QC Report</h2>
            <form onSubmit={handleUpload} className="upload-form">
              <label htmlFor="csv-input" className="file-input-label">
                Choose CSV File
              </label>
              <input 
                type="file" 
                id="csv-input" 
                className="file-input" 
                accept=".csv" 
                onChange={handleFileChange} 
              />
              {selectedFile && <span className="file-name-display">{selectedFile.name}</span>}
              <button type="submit" className="btn btn-primary" disabled={uploading || !selectedFile}>
                {uploading ? 'Processing...' : 'Upload'}
              </button>
            </form>
          </div>

          <div className="card">
            <h2 className="card-title">Uploaded QC Submissions</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Source Filename</th>
                    <th>Batch Number</th>
                    <th>Overall Status</th>
                    <th className="action-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center' }}>Loading submissions...</td></tr>
                  ) : error ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', color: '#e53e3e' }}>{error}</td></tr>
                  ) : submissions.length > 0 ? (
                    submissions.map(sub => (
                      <tr key={sub.qcCid}>
                        <td>{sub.qcDetailsFromIPFS?.meta?.sourceFilename || 'N/A'}</td>
                        <td>{sub.batchNumber}</td>
                        <td>
                          <span className={`status status-${sub.isStandard ? 'pass' : 'fail'}`}>
                            {sub.isStandard ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                        <td className="action-column">
                          <button className="btn btn-primary" onClick={() => handleViewFile(sub.qcGatewayUrl)}>View</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="4" style={{ textAlign: 'center' }}>No QC submissions found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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

const Header = ({ user, onLogout }) => (
  <div className="header">
    <h2 className="header-title">QC Document Portal</h2>
    <div className="profile-section">
      
      <svg className="profile-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
      <span className="profile-name">
        {user?.email?.split('@')[0] || 'Uploader'}
      </span>
      <button className="btn-logout" onClick={onLogout}>Logout</button>
    </div>
  </div>
);