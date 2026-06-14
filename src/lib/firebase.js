import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace with your actual Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBIblyjdpG9h4rG6_rUg13wYMPdrIQJvHo",
  authDomain: "cramaquest-702d1.firebaseapp.com",
  projectId: "cramaquest-702d1",
  storageBucket: "cramaquest-702d1.firebasestorage.app",
  messagingSenderId: "862524380456",
  appId: "1:862524380456:web:e5c07db6f3bb1788b72c1d",
  measurementId: "G-V4RX8EKS4F"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
