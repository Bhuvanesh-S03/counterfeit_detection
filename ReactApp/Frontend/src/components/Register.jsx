import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../Firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  setDoc,
  doc,
  getDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';

// --- Main Component for the Registration Page ---
export default function Register ({ onLoginSuccess }) {
  const [isLoginView, setLoginView] = useState(true);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (message, type = 'info') => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <div className='register-wrapper'>
      <style>{`
        /* --- STYLES --- */
        @font-face {
            font-family: 'Mozilla Headline';
            src: url('/static/MozillaHeadline-Regular.ttf') format('truetype');
        }
        @font-face {
            font-family: 'Mozilla Headline';
            src: url('/static/MozillaHeadline-Bold.ttf') format('truetype');
            font-weight: bold;
        }
        * {
            margin: 0; padding: 0; box-sizing: border-box;
            font-family: 'Mozilla Headline', sans-serif;
        }
        html, body, #root { height: 100%; }
        body {
            color: #ecf0f1;
            background: linear-gradient(-45deg, #0b0c10, #1f2833, #157272, #0b0c10);
            background-size: 400% 400%;
            animation: animated-background 25s ease infinite;
            overflow: hidden;
        }
        .register-wrapper {
            width: 100vw; height: 100vh;
            display: flex; justify-content: center; align-items: center;
        }
        .pills-animation-container {
            position: fixed; top: 0; left: 0; width: 100%;
            height: 100%; overflow: hidden; z-index: 0; pointer-events: none;
        }
        .pill {
            position: absolute; display: block; width: 15px; height: 35px;
            border-radius: 20px; background-color: rgba(102, 252, 241, 0.15);
            bottom: -150px; animation: move-diagonally linear infinite;
        }
        .pill::before {
            content: ''; position: absolute; width: 100%; height: 50%;
            background-color: rgba(236, 240, 241, 0.15);
            border-top-left-radius: 20px; border-top-right-radius: 20px;
        }
        .pill:nth-child(1) { left: 10%; animation-duration: 15s; }
        .pill:nth-child(2) { left: 20%; animation-duration: 12s; }
        .pill:nth-child(3) { left: 30%; animation-duration: 18s; }
        .pill:nth-child(4) { left: 40%; animation-duration: 10s; }
        .pill:nth-child(5) { left: 50%; animation-duration: 16s; }
        .pill:nth-child(6) { left: 60%; animation-duration: 11s; }
        .pill:nth-child(7) { left: 70%; animation-duration: 14s; }
        .pill:nth-child(8) { left: 80%; animation-duration: 19s; }
        .pill:nth-child(9) { left: 90%; animation-duration: 13s; }
        .pill:nth-child(10) { left: 5%; animation-duration: 17s; }

        .auth-container {
            background: rgba(43, 43, 43, 0.8); backdrop-filter: blur(10px);
            padding: 40px; border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            width: 450px; text-align: center; z-index: 1; position: relative;
        }
        .auth-title {
            font-size: 2rem; font-weight: 700; color: #f1f1f1; margin-bottom: 10px;
        }
        .auth-subtitle {
            font-size: 1rem; color: #ccc; margin-bottom: 30px;
        }
        .form-group { margin-bottom: 20px; text-align: left; }
        .form-group label {
            display: block; font-weight: 600; margin-bottom: 8px; color: #ccc;
        }
        .form-group input {
            width: 100%; padding: 12px; border: 1px solid #444; border-radius: 8px;
            font-size: 1rem; background-color: #333; color: #f1f1f1;
            transition: border-color 0.3s ease;
        }
        input:-webkit-autofill {
            -webkit-box-shadow: 0 0 0 1000px #333 inset !important;
            -webkit-text-fill-color: #f1f1f1 !important;
        }
        .form-group input:focus {
            outline: none; border-color: #66fcf1;
            box-shadow: 0 0 0 3px rgba(102, 252, 241, 0.3);
        }
        .role-selection-group { display: flex; gap: 10px; margin-bottom: 20px; }
        .role-btn {
            flex: 1; padding: 15px 10px; border: 2px solid #555; border-radius: 12px;
            background: #444; color: #ccc; font-weight: 600; cursor: pointer;
            transition: all 0.3s ease; display: flex; flex-direction: column;
            align-items: center; justify-content: center; text-align: center;
        }
        .role-btn .role-icon { font-size: 2rem; margin-bottom: 5px; }
        .role-btn:hover { border-color: #777; color: white; }
        .role-btn.active { border-color: #66fcf1; background: #333; color: white; }
        .btn {
            width: 100%; padding: 15px; border: none; border-radius: 8px;
            cursor: pointer; font-size: 1.1rem; font-weight: 600; color: #1c1c1c;
            background: #f1f1f1; transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .btn:disabled { background: #888; cursor: not-allowed; }
        .btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.4);
        }
        .switch-auth-mode { margin-top: 20px; color: #ccc; }
        .switch-auth-mode a {
            color: #66fcf1; text-decoration: none; font-weight: 600;
            cursor: pointer; transition: color 0.3s ease;
        }
        .switch-auth-mode a:hover { color: #f1f1f1; text-decoration: underline; }
        .form-section { display: none; animation: fadeIn 0.5s ease-in-out; }
        .form-section.active { display: block; }
        .toast {
            position: fixed; top: 20px; left: 50%;
            transform: translateX(-50%); padding: 12px 20px;
            border-radius: 8px; color: white; font-weight: 600;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 9999;
            animation: slideInDown 0.5s ease;
        }
        .toast.success { background-color: #27ae60; }
        .toast.error { background-color: #c0392b; }
        .toast.info { background-color: #2980b9; }

        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes animated-background { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes move-diagonally { from { transform: translateY(0) rotate(-45deg); } to { transform: translateY(-120vh) rotate(-45deg); } }
        @keyframes slideInDown { from { top: -100px; opacity: 0; } to { top: 20px; opacity: 1; } }
      `}</style>
      
      {toastMsg && <div className={`toast ${toastMsg.type}`}>{toastMsg.message}</div>}

      <PillsAnimation />
      <div className='auth-container'>
        {isLoginView ? (
          <LoginForm
            setLoginView={setLoginView}
            showToast={showToast}
            onLoginSuccess={onLoginSuccess}
          />
        ) : (
          <SignupForm setLoginView={setLoginView} showToast={showToast} />
        )}
      </div>
    </div>
  );
}

// --- Child Components ---

const PillsAnimation = () => (
  <div className='pills-animation-container'>
    {[...Array(10)].map((_, i) => <div key={i} className='pill'></div>)}
  </div>
);

const LoginForm = ({ setLoginView, showToast, onLoginSuccess }) => {
  const [role, setRole] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async e => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('User data not found in database.');
      }

      const data = { uid, ...userDoc.data() };

      if (data.role !== role) {
        showToast(`Incorrect role. Please select the "${data.role}" role to log in.`, 'error');
        await signOut(auth); 
        setLoading(false);
        return;
      }

      if (data.status === 'pending') {
        showToast('Your request is pending admin approval.', 'info');
        await signOut(auth);
        setLoading(false);
        return;
      }
      if (data.status === 'rejected') {
        showToast('Your registration request was rejected.', 'error');
        await signOut(auth);
        setLoading(false);
        return;
      }

      showToast(`Welcome ${data.role}!`, 'success');
      onLoginSuccess(data);

    } catch (err) {
      showToast(err.message, 'error');
      setLoading(false);
    }
  };

  return (
    <div id='loginForm' className='form-section active'>
      <h1 className='auth-title'>Welcome Back</h1>
      <p className='auth-subtitle'>Log in to your account</p>
      <form onSubmit={handleLogin}>
        <div className='form-group'>
          <label>Role</label>
          <div className='role-selection-group'>
            <button type='button' className={`role-btn ${role === 'admin' ? 'active' : ''}`} onClick={() => setRole('admin')}>
              <span className='role-icon'>🛡️</span> Admin
            </button>
            <button type='button' className={`role-btn ${role === 'Manufacturer' ? 'active' : ''}`} onClick={() => setRole('Manufacturer')}>
              <span className='role-icon'>🏭</span> Manufacturer
            </button>
            <button type='button' className={`role-btn ${role === 'QCUploader' ? 'active' : ''}`} onClick={() => setRole('QCUploader')}>
              <span className='role-icon'>🔬</span> QC Uploader
            </button>
          </div>
        </div>
        <div className='form-group'>
          <label htmlFor='login-email'>Email Address</label>
          <input type='email' id='login-email' placeholder='Enter your email' required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className='form-group'>
          <label htmlFor='login-password'>Password</label>
          <input type='password' id='login-password' placeholder='Enter your password' required value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button type='submit' className='btn' disabled={loading}>
          {loading ? 'Verifying...' : 'Login'}
        </button>
      </form>
      <p className='switch-auth-mode'>
        Don't have an account?{' '}
        <a onClick={() => setLoginView(false)}>Sign up</a>
      </p>
    </div>
  );
};

const SignupForm = ({ setLoginView, showToast }) => {
  const [role, setRole] = useState('Manufacturer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [licenseId, setLicenseId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      if (role === 'admin') {
        const q = query(collection(db, 'users'), where('role', '==', 'admin'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          throw new Error('An admin account already exists. Only one is allowed.');
        }
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      let userData = {
        email,
        role,
        createdAt: serverTimestamp()
      };

      if (role === 'Manufacturer') {
        if (!companyName || !licenseId)
          throw new Error('Company Name and License ID are required.');
        userData = { ...userData, companyName, licenseId, status: 'pending' };
      } else if (role === 'QCUploader') {
        userData = { ...userData, status: 'pending' };
      } else if (role === 'admin') {
        userData = { ...userData, status: 'approved' };
      }

      await setDoc(doc(db, 'users', uid), userData);

      showToast('Signup successful! Please log in.', 'success');
      setTimeout(() => setLoginView(true), 1500);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id='signupForm' className='form-section active'>
      <h1 className='auth-title'>Create an Account</h1>
      <p className='auth-subtitle'>Join the portal</p>
      <form onSubmit={handleSignup}>
        <div className='form-group'>
          <label>Select Your Role</label>
          <div className='role-selection-group'>
            <button type='button' className={`role-btn ${role === 'Manufacturer' ? 'active' : ''}`} onClick={() => setRole('Manufacturer')}>
              <span className='role-icon'>🏭</span> Manufacturer
            </button>
            <button type='button' className={`role-btn ${role === 'QCUploader' ? 'active' : ''}`} onClick={() => setRole('QCUploader')}>
              <span className='role-icon'>🔬</span> QC Uploader
            </button>
            <button type='button' className={`role-btn ${role === 'admin' ? 'active' : ''}`} onClick={() => setRole('admin')}>
              <span className='role-icon'>🛡️</span> Admin
            </button>
          </div>
        </div>

        {role === 'Manufacturer' && (
          <>
            <div className='form-group'>
              <label htmlFor='signup-companyname'>Company Name</label>
              <input type='text' id='signup-companyname' placeholder='Enter your company name' required value={companyName} onChange={e => setCompanyName(e.target.value)} />
            </div>
            <div className='form-group'>
              <label htmlFor='signup-licenseid'>License ID</label>
              <input type='text' id='signup-licenseid' placeholder='Enter your license ID' required value={licenseId} onChange={e => setLicenseId(e.target.value)} />
            </div>
          </>
        )}

        <div className='form-group'>
          <label htmlFor='signup-email'>Email Address</label>
          <input type='email' id='signup-email' placeholder='Enter your email' required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className='form-group'>
          <label htmlFor='signup-password'>Password</label>
          <input type='password' id='signup-password' placeholder='Create a password (min 6 characters)' required value={password} onChange={e => setPassword(e.target.value)} />
        </div>

        <button type='submit' className='btn' disabled={loading}>
          {loading ? 'Creating Account...' : 'Sign up'}
        </button>
      </form>
      <p className='switch-auth-mode'>
        Already have an account?{' '}
        <a onClick={() => setLoginView(true)}>Login</a>
      </p>
    </div>
  );
};  