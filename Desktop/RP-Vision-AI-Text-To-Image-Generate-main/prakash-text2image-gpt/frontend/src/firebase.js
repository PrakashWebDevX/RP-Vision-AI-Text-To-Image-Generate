import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDPD4uqjiACdyujIXHJIH-fGFT5XPtnUl8",
  authDomain: "rp-vision-ai.firebaseapp.com",
  projectId: "rp-vision-ai",
  storageBucket: "rp-vision-ai.firebasestorage.app",
  messagingSenderId: "509434799486",
  appId: "1:509434799486:web:8de0383b0841ecc63e7f2f",
  measurementId: "G-V03B9FEVKZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);