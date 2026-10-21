// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

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

// Testes locais: com REACT_APP_USE_EMULATORS=true (definido só ao compilar para teste) o app fala com
// os emuladores do Firebase em vez do projeto real. Em produção essa variável não existe.
if (process.env.REACT_APP_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
}
