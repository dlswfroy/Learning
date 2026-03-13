'use client';

import { initializeApp, getApps, getApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyAvfNOxGdLizYAYT2_JDVMgGkmWMfWdv2c",
  authDomain: "birganj-pouro-high-schoo-9d39d.firebaseapp.com",
  projectId: "birganj-pouro-high-schoo-9d39d",
  storageBucket: "birganj-pouro-high-schoo-9d39d.firebasestorage.app",
  messagingSenderId: "675279004643",
  appId: "1:675279004643:web:a2184d3e7e59fbc00976d6",
  measurementId: "G-T9NZCKH4N5"
};

export const getFirebaseApp = () => {
  if (getApps().length > 0) return getApp();
  return initializeApp(firebaseConfig);
};
