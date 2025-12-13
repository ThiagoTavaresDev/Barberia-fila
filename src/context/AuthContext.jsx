import React, { createContext, useState, useEffect, useContext } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    createUserWithEmailAndPassword
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
                    email: firebaseUser.email,
                };

                if (userDoc.exists()) {
                    userData = { ...userData, ...userDoc.data() };
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

    const logout = () => {
        return signOut(auth);
    };

    const value = {
        user,
        login,
        signup,
        updateProfile,
        logout,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
