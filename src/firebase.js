// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// COLE AQUI SUA CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "barber-fila.firebaseapp.com",
  projectId: "barber-fila",
  storageBucket: "barber-fila.firebasestorage.app",
  messagingSenderId: "881049673514",
  appId: "1:881049673514:web:99eb16666f7c1e6d300853",
  measurementId: "G-JCXQRD586E"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta Firestore e Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
auth.languageCode = 'pt-BR';
