import React, { createContext, useState, useEffect, useContext } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Obter dados adicionais do Firestore (Nome da Loja, etc)
                const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
                let userData = {
                    id: firebaseUser.uid,
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                };

                if (userDoc.exists()) {
                    // INFO: Garantir que o ID do Auth PREVALEÇA sobre qualquer ID salvo no banco
                    // Isso evita que contas copiadas/clonadas compartilhem o mesmo ID funcional
                    const docData = userDoc.data();
                    userData = {
                        ...userData,
                        ...docData,
                        id: firebaseUser.uid,
                        uid: firebaseUser.uid
                    };
                }

                setUser(userData);
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const login = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const signup = async (email, password, shopName, name) => {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        // Criar perfil no Firestore
        await setDoc(doc(db, "users", result.user.uid), {
            shopName,
            name,
            createdAt: Date.now()
        });
        return result;
    };

    const updateProfile = async (updates) => {
        if (!user) return;

        await updateDoc(doc(db, "users", user.id), updates);

        // Atualizar estado local
        setUser(prev => ({ ...prev, ...updates }));
    };

    // Atualiza apenas o estado local (quando a escrita no Firestore já foi feita em outro lugar)
    const patchUser = (updates) => {
        setUser(prev => (prev ? { ...prev, ...updates } : prev));
    };

    const logout = () => {
        return signOut(auth);
    };

    // Confirma a senha de quem já está logado (usado antes de mudar a chave Pix, que redireciona dinheiro).
    // Lança um erro com mensagem pronta para mostrar na tela.
    const reauthenticate = async (password) => {
        const current = auth.currentUser;
        if (!current?.email) throw new Error("Sua sessão expirou. Entre novamente.");
        try {
            await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
        } catch (error) {
            if (error.code === "auth/too-many-requests") {
                throw new Error("Muitas tentativas. Aguarde alguns minutos e tente de novo.");
            }
            if (error.code === "auth/network-request-failed") {
                throw new Error("Sem internet. Tente de novo.");
            }
            throw new Error("Senha incorreta.");
        }
    };

    const value = {
        user,
        login,
        signup,
        updateProfile,
        patchUser,
        logout,
        reauthenticate,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
