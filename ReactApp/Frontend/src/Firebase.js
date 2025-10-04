import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyDCHaVCOLU8EQmh-ERQ--01RoxAOvfDp10",
  authDomain: "drugauthentication.firebaseapp.com",
  projectId: "drugauthentication",
  storageBucket: "drugauthentication.firebasestorage.app",
  messagingSenderId: "354991474343",
  appId: "1:354991474343:web:70e10501163553becafd82"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);