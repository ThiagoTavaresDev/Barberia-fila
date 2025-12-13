import {
    doc,
    setDoc,
    getDoc,
    onSnapshot,
} from "firebase/firestore";

import { db } from "../firebase";

const getStatusDoc = (userId) => {
    if (!userId) throw new Error("UserId is required");
    return doc(db, "users", userId, "queue", "barber_status_config");
};

/**
 * Define o status do barbeiro
 */
export async function setBarberStatus(userId, status, duration = null) {
    const statusDoc = getStatusDoc(userId);
    const data = {
        status,
        updatedAt: Date.now(),
    };

    if (status === "on_break") {
        if (duration) {
            data.breakStartedAt = Date.now();
            data.breakDuration = duration;
            data.breakEndsAt = Date.now() + duration * 60 * 1000;
        } else {
            data.breakStartedAt = Date.now();
            data.breakDuration = null;
            data.breakEndsAt = null;
        }
    } else if (status === "available") {
        data.breakStartedAt = null;
        data.breakDuration = null;
        data.breakEndsAt = null;
    }

    await setDoc(statusDoc, data, { merge: true });
}

/**
 * Obtém o status atual do barbeiro
 */
export async function getBarberStatus(userId) {
    if (!userId) return { status: 'available' };
    const statusDoc = getStatusDoc(userId);
    const snapshot = await getDoc(statusDoc);
    if (snapshot.exists()) {
        return snapshot.data();
    }
    return {
        status: "available",
        breakStartedAt: null,
        breakDuration: null,
        breakEndsAt: null,
        updatedAt: Date.now(),
    };
}

/**
 * Listener em tempo real
 */
export function listenBarberStatus(userId, callback) {
    if (!userId) return () => { };
    const statusDoc = getStatusDoc(userId);

    return onSnapshot(statusDoc, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.data());
        } else {
            // First time access might not have doc, return available
            callback({
                status: "available",
                breakStartedAt: null,
                breakDuration: null,
                breakEndsAt: null,
                updatedAt: Date.now(),
            });
        }
    });
}

/**
 * Finaliza a pausa manualmente
 */
export async function endBreak(userId) {
    await setBarberStatus(userId, "available");
}

export async function toggleBarberStatus(userId, isOpen) {
    const status = isOpen ? 'available' : 'closed';
    await setBarberStatus(userId, status);
}
