import React, { useState, useEffect } from 'react';

// Main Component for the Manufacturer Portal
export default function ManufacturerPortal({ user, onLogout }) {
  const [view, setView] = useState('home'); // 'home' or 'wizard'
  const [batches, setBatches] = useState([]);

  // Load data from localStorage on initial render
  useEffect(() => {
    try {
      const storedData = localStorage.getItem('batchDetailsDataBase');
      if (storedData) {
        setBatches(JSON.parse(storedData));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
    }
  }, []);

  const startNewBatch = () => {
    setView('wizard');
  };

  const finishBatchCreation = (newBatch) => {
    const updatedBatches = [newBatch, ...batches];
    setBatches(updatedBatches);
    localStorage.setItem('batchDetailsDataBase', JSON.stringify(updatedBatches));
    setView('home');
  };

  const deleteBatch = (batchIdToDelete) => {
    if (window.confirm(`Are you sure you want to delete Batch ID: ${batchIdToDelete}?`)) {
        const updatedBatches = batches.filter(batch => batch.batchId !== batchIdToDelete);
        setBatches(updatedBatches);
        localStorage.setItem('batchDetailsDataBase', JSON.stringify(updatedBatches));
    }
  };

  return (
    <>
      <style>{`
        /* General Styles */
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
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Mozilla Headline', sans-serif;
        }

        /* Themed Background */
        body {
            background: linear-gradient(-45deg, #0b0c10, #1f2833, #157272, #0b0c10);
            background-size: 400% 400%;
            animation: animated-background 25s ease infinite;
            color: #ecf0f1;
            min-height: 100vh;
            overflow-x: hidden;
            display: flex;
            justify-content: center;
            padding-top: 80px; /* Adjusted padding */
        }

        /* Pills Animation Container */
        .pills-animation-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            z-index: -1;
            pointer-events: none;
        }

        .pill {
            position: absolute;
            display: block;
            width: 15px;
            height: 35px;
            border-radius: 20px;
            background-color: rgba(102, 252, 241, 0.15);
            bottom: -150px;
            animation: move-diagonally linear infinite;
        }

        .pill::before {
            content: '';
            position: absolute;
            width: 100%;
            height: 50%;
            background-color: rgba(236, 240, 241, 0.15);
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
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

        /* Fixed Header */
        .header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            background: rgba(28, 28, 28, 0.8);
            backdrop-filter: blur(10px);
            padding: 15px 30px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .header-title { font-size: 1.8rem; font-weight: 600; }
        .profile-section { display: flex; align-items: center; gap: 15px; }
        .profile-icon { width: 40px; height: 40px; fill: #ecf0f1; }
        .profile-info { text-align: right; }
        .profile-name { font-weight: 600; display: block; }
        .profile-id { font-size: 0.9rem; color: #ccc; }


        /* Main Container */
        .container {
            width: 100%;
            max-width: 1400px; 
            padding: 0 20px;
            margin-top: 20px; 
        }

        /* Card styles */
        .card {
            background: rgba(43, 43, 43, 0.8);
            backdrop-filter: blur(5px);
            padding: 40px; 
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            margin-bottom: 30px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            min-height: 300px;
        }
        
        .card-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #f1f1f1;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        /* Table Styles */
        .table-container { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(51, 51, 51, 0.8); font-weight: 600; color: #f1f1f1; }
        th, td { padding: 15px; text-align: left; border-bottom: 1px solid rgba(135, 153, 166, 0.2); }
        tr:hover { background-color: rgba(54, 54, 54, 0.7); }

        /* Form Styles */
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;}
        .form-group { display: flex; flex-direction: column; }
        .form-group label { margin-bottom: 8px; font-weight: 600; color: #ccc; }
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 1px solid #444;
            border-radius: 8px;
            font-size: 1rem;
            background-color: #333;
            color: #f1f1f1;
            font-family: 'Mozilla Headline', sans-serif;
        }
        .form-group input:focus { outline: none; border-color: #66fcf1; }

        /* Button Styles */
        .btn { padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.3s ease; }
        .btn-primary { background: #66fcf1; color: #1c1c1c; }
        .btn-primary:hover { background: #f1f1f1; }
        .btn-secondary { background: #444; color: #f1f1f1; }
        .btn-secondary:hover { background: #555; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-full { width: 100%; }
        .btn-small { padding: 8px 16px; font-size: 1rem; }
        .btn-delete {
            background-color: #c0392b;
            color: white;
            padding: 5px 10px;
            font-size: 0.8rem;
            margin-left: 15px;
        }
        .btn-delete:hover { background-color: #e74c3c; }
        .btn-logout { background: #c0392b; color: white; padding: 8px 12px; font-weight: 600;}
        .btn-logout:hover { background: #e74c3c; }

        /* Wizard */
        .wizard-step { display: none; }
        .wizard-step.active { display: block; animation: fadeIn 0.5s; }
        .wizard-nav { display: flex; justify-content: space-between; margin-top: 30px; }
        
        /* Image Uploader */
        .image-uploader-container { text-align: center; margin-bottom: 20px; }
        .image-preview { width: 100%; max-width: 250px; height: auto; border-radius: 10px; border: 2px dashed #444; margin: 10px auto; padding: 10px; }
        .loader { border: 4px solid #f3f3f3; border-top: 4px solid #66fcf1; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
        
        /* Batch List */
        .batch-list { display: flex; flex-direction: column; gap: 20px; }
        .batch-item { background: rgba(43, 43, 43, 0.7); border-radius: 15px; overflow: hidden; }
        .batch-summary { padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border-bottom: 1px solid #444; }
        .batch-summary-info { display: flex; align-items: center; }
        .batch-details { padding: 30px; display: none; }
        .batch-details.expanded { display: block; }
        .data-output { margin-top: 20px; padding: 20px; background: #333; border-radius: 8px; overflow-x: auto; white-space: pre; font-family: monospace; }
        .download-btn { display: inline-block; margin-top: 15px; color: #66fcf1; text-decoration: none; font-weight: 600; }
        
        .empty-batch-list {
            display: flex;
            justify-content: center;
            align-items: center;
            text-align: center;
            min-height: 150px; 
            color: #ccc;
        }

        /* Status Messages */
        .status-message {
            padding: 15px;
            margin-top: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .status-message.success { background-color: #27ae60; color: white; }
        .status-message.error { background-color: #c0392b; color: white; }
        .status-message.info { background-color: #2980b9; color: white; }

        /* Animations */
        @keyframes animated-background { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes move-diagonally {
            from { transform: translateY(0) rotate(-45deg) scale(var(--scale, 1)); }
            to { transform: translateY(-120vh) rotate(-45deg) scale(var(--scale, 1)); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
      <PillsAnimation />
      <Header user={user} onLogout={onLogout} />
      <div className="container">
        {view === 'home' && <HomeScreen batches={batches} onNewBatchClick={startNewBatch} onDeleteBatch={deleteBatch} />}
        {view === 'wizard' && <BatchWizard onFinish={finishBatchCreation} />}
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
  <header className="header">
    <div className="header-title">Manufacturer Portal</div>
    <div className="profile-section">
      <div className="profile-info">
        <span className="profile-name">{user.name}</span>
        <span className="profile-id">ID: {user.id || 'N/A'}</span>
      </div>
      <svg className="profile-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
      <button className="btn btn-logout" onClick={onLogout}>Logout</button>
    </div>
  </header>
);

const HomeScreen = ({ batches, onNewBatchClick, onDeleteBatch }) => (
  <div id="homeScreen" className="card">
    <div className="card-title">
      <h2>My Batches</h2>
      <button onClick={onNewBatchClick} className="btn btn-small btn-primary">Create New Batch +</button>
    </div>
    <div id="batchList">
      {batches.length > 0 ? (
        <div className="batch-list">
            {batches.map((batch, index) => <BatchItem key={index} batch={batch} onDelete={onDeleteBatch} />)}
        </div>
      ) : (
        <div className="empty-batch-list">
            <p>No batches created yet. <br/> Click "Create New Batch" to start.</p>
        </div>
      )}
    </div>
  </div>
);

const BatchItem = ({ batch, onDelete }) => {
  const [isExpanded, setExpanded] = useState(false);

  const handleDelete = (e) => {
    e.stopPropagation(); 
    onDelete(batch.batchId);
  };

  return (
    <div className="batch-item">
      <div className="batch-summary" onClick={() => setExpanded(!isExpanded)}>
        <div className="batch-summary-info">
            <h3>Batch ID: {batch.batchId}</h3>
            <button className="btn-delete" onClick={handleDelete}>Delete</button>
        </div>
        <span>{isExpanded ? '▲' : '▼'}</span>
      </div>
      <div className={`batch-details ${isExpanded ? 'expanded' : ''}`}>
        <div style={{ textAlign: 'center' }}>
            <h4>Batch Image</h4>
            <img src={batch.batchImage} alt="Batch Preview" className="image-preview" style={{ display: 'block' }} />
            <a href={batch.batchImage} download={`${batch.batchId}-image.png`} className="download-btn">
                Download Image
            </a>
        </div>
        <h4 style={{ marginTop: '20px' }}>Products in Batch</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Product ID</th><th>Name</th><th>Manuf. Date</th><th>Expiry Date</th></tr>
            </thead>
            <tbody>
              {batch.products.map((p, index) => (
                <tr key={index}>
                  <td>{p.productId}</td><td>{p.productName}</td><td>{p.mfgDate}</td><td>{p.expiryDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const BatchWizard = ({ onFinish }) => {
  const [step, setStep] = useState(1);
  const [batchData, setBatchData] = useState({
    batchId: '',
    manufId: '',
    batchImage: null,
    products: []
  });
  const [imageLoading, setImageLoading] = useState(false);
  const [isImageSaved, setImageSaved] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });

  const showMessage = (message, type, duration = 4000) => {
    setStatus({ message, type });
    setTimeout(() => setStatus({ message: '', type: '' }), duration);
  };
  
  const handleStep1Submit = (e) => {
    e.preventDefault();
    if (!e.target.batchId.value.trim() || !e.target.manufId.value.trim()) {
      showMessage('Please fill in all fields.', 'error');
      return;
    }
    setBatchData({
      ...batchData,
      batchId: e.target.batchId.value,
      manufId: e.target.manufId.value,
    });
    setStep(2);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImageLoading(true);
    setImageSaved(false);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setTimeout(() => {
        setBatchData({ ...batchData, batchImage: reader.result });
        setImageLoading(false);
        showMessage('Image ready for saving.', 'success');
      }, 1500);
    };
    reader.readAsDataURL(file);
  };

  const saveImage = () => {
    if (!batchData.batchImage) {
      showMessage('No image to save.', 'error');
      return;
    }
    setImageSaved(true);
    showMessage('Image saved successfully!', 'success');
  }

  const handleAddManualProduct = (e) => {
    e.preventDefault();
    const newProduct = {
      productId: e.target.productId.value,
      productName: e.target.productName.value,
      mfgName: "Acme Pharmaceuticals",
      mfgDate: e.target.mfDate.value,
      expiryDate: e.target.expDate.value,
      batchNumber: batchData.batchId,
      manufacturerId: batchData.manufId
    };
    setBatchData({ ...batchData, products: [...batchData.products, newProduct] });
    showMessage(`Product ${newProduct.productId} added.`, 'success');
    e.target.reset();
  };
  
  const handleAddRange = (e) => {
      e.preventDefault();
      const startId = e.target.startId.value;
      const endId = e.target.endId.value;

      const [prefix, startNumStr] = startId.split('-');
      const [, endNumStr] = endId.split('-');
    
      const startNum = parseInt(startNumStr, 10);
      const endNum = parseInt(endNumStr, 10);
      
      if (isNaN(startNum) || isNaN(endNum) || startNum > endNum || 
          prefix !== startId.split('-')[0] || prefix !== endId.split('-')[0]) {
        showMessage('Invalid ID range. Please check the format (e.g., PRD-001) and order.', 'error');
        return;
      }
      
      const newProducts = [];
      for (let i = startNum; i <= endNum; i++) {
        const pId = `${prefix}-${String(i).padStart(startNumStr.length, '0')}`;
        newProducts.push({
          productId: pId,
          productName: 'Product Name',
          mfgName: "Acme Pharmaceuticals",
          mfgDate: 'N/A',
          expiryDate: 'N/A',
          batchNumber: batchData.batchId,
          manufacturerId: batchData.manufId
        });
      }
      
      setBatchData(prev => ({ ...prev, products: [...prev.products, ...newProducts] }));
      showMessage(`Added ${newProducts.length} products to the batch.`, 'success');
      e.target.reset();
  };

  const handleFinishBatch = async () => {
    if (batchData.products.length === 0) {
      showMessage('Please add at least one product before finishing.', 'error');
      return;
    }

    const API_URL = 'http://10.106.144.139:8000';

    try {
      showMessage('Step 1/4: Sending batch details to blockchain...', 'info');
      const batchResponse = await fetch(`${API_URL}/add_batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchNumber: batchData.batchId,
          manufacturerId: batchData.manufId
        }),
      });
      if (!batchResponse.ok) throw new Error('Failed to add batch to blockchain');
      
      showMessage('Step 2/4: Adding products to blockchain...', 'info');
      const productHashes = [];
      for (const product of batchData.products) {
        const productResponse = await fetch(`${API_URL}/add_product`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(product),
        });
        if (!productResponse.ok) throw new Error(`Failed to add product ${product.productId}`);
        const productResult = await productResponse.json();
        productHashes.push(productResult.productHash);
      }
      
      showMessage('Step 3/4: Embedding watermark into batch image...', 'info');
      const formData = new FormData();
      const firstProductHash = productHashes[0];
      
      const blob = await (await fetch(batchData.batchImage)).blob();
      const imageFile = new File([blob], `${batchData.batchId}.png`, { type: 'image/png' });
      
      formData.append('dataHash', firstProductHash);
      formData.append('file', imageFile);
      
      const watermarkResponse = await fetch(`${API_URL}/embed_robust_watermark`, {
        method: 'POST',
        body: formData,
      });
      if (!watermarkResponse.ok) throw new Error('Failed to embed watermark');
      const watermarkResult = await watermarkResponse.json();
      const downloadUrl = watermarkResult.download_url;

      showMessage('Step 4/4: Downloading watermarked image...', 'info');
      const downloadResponse = await fetch(downloadUrl);
      const downloadBlob = await downloadResponse.blob();
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(downloadBlob);
      link.download = `watermarked_${batchData.batchId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      showMessage('Batch completed and submitted to blockchain successfully!', 'success');
      
      onFinish({
          ...batchData,
          creationDate: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error submitting batch:', error);
      showMessage(`Failed to complete batch. Error: ${error.message}`, 'error');
    }
  };

  return (
    <div className="card">
      {/* Step 1 */}
      <div className={`wizard-step ${step === 1 ? 'active' : ''}`}>
        <h2 className="card-title">Step 1: Batch Details</h2>
        <form onSubmit={handleStep1Submit}>
          <div className="form-group"><label htmlFor="batchId">Batch ID</label><input type="text" id="batchId" required /></div>
          <div className="form-group"><label htmlFor="manufId">Manufacturer ID</label><input type="text" id="manufId" required /></div>
          <div className="wizard-nav"><div /><button type="submit" className="btn btn-primary">Next</button></div>
        </form>
      </div>
      {/* Step 2 */}
      <div className={`wizard-step ${step === 2 ? 'active' : ''}`}>
        <h2 className="card-title">Step 2: Upload Image</h2>
        <div className="image-uploader-container">
          <input type="file" id="batchImageInput" accept="image/png, image/jpeg" onChange={handleImageUpload} />
          {imageLoading && <div className="loader" />}
          {batchData.batchImage && !imageLoading && <img src={batchData.batchImage} alt="Preview" className="image-preview" style={{display: 'block'}} />}
        </div>
        <button className="btn" onClick={saveImage} disabled={!batchData.batchImage || imageLoading}>Save Image</button>
        <div className="wizard-nav">
          <button className="btn btn-secondary" onClick={() => setStep(1)}>Previous</button>
          <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!isImageSaved}>Next</button>
        </div>
      </div>
      {/* Step 3 */}
      <div className={`wizard-step ${step === 3 ? 'active' : ''}`}>
        <h2 className="card-title">Step 3: Add Products to Batch ({batchData.batchId})</h2>
        
        <h3>Add Products Manually</h3>
        <form onSubmit={handleAddManualProduct}>
            <div className="form-row">
                <div className="form-group"><label>Product ID</label><input type="text" name="productId" required /></div>
                <div className="form-group"><label>Product Name</label><input type="text" name="productName" required /></div>
            </div>
            <div className="form-row">
                <div className="form-group"><label>Manufacture Date</label><input type="date" name="mfDate" required /></div>
                <div className="form-group"><label>Expiry Date</label><input type="date" name="expDate" required /></div>
            </div>
            <button type="submit" className="btn btn-full">Add Product to Batch</button>
        </form>
        
        <h3 style={{margin: '30px 0 10px'}}>Add Products by Range</h3>
        <form onSubmit={handleAddRange}>
            <div className="form-row">
                <div className="form-group"><label>Start Product ID</label><input type="text" name="startId" placeholder="e.g., PRD-001" /></div>
                <div className="form-group"><label>End Product ID</label><input type="text" name="endId" placeholder="e.g., PRD-100" /></div>
            </div>
            <button type="submit" className="btn btn-full">Add Range to Batch</button>
        </form>

        <div className="wizard-nav">
          <button className="btn btn-secondary" onClick={() => setStep(2)}>Previous</button>
          <button className="btn btn-primary" onClick={handleFinishBatch} disabled={batchData.products.length === 0}>Complete & Submit Batch</button>
        </div>
        
        {status.message && <div className={`status-message ${status.type}`}>{status.message}</div>}

        {batchData.products.length > 0 && (
            <div className="data-output">
                <h4>Products Added: {batchData.products.length}</h4>
                <pre>{JSON.stringify(batchData.products.map(p => p.productId), null, 2)}</pre>
            </div>
        )}
      </div>
    </div>
  );
};