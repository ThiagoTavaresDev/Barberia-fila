// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// COLE AQUI SUA CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBf9KcB-xI2aA_l-IJJfpb9pt6UsSNJ4rY",
    authDomain: "barber-fila.firebaseapp.com",
    projectId: "barber-fila",
    storageBucket: "barber-fila.firebasestorage.app",
    messagingSenderId: "881049673514",
    appId: "1:881049673514:web:99eb16666f7c1e6d300853",
    measurementId: "G-JCXQRD586E"
  };

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta Firestore
export const db = getFirestore(app);
