import {
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    updateDoc,
} from "firebase/firestore";

import { db } from "../firebase";

const barberStatusDoc = doc(db, "queue", "barber_status_config");

/**
 * Define o status do barbeiro
 * @param {string} status - "available" ou "on_break"
 * @param {number} duration - Duração da pausa em minutos (opcional)
 */
export async function setBarberStatus(status, duration = null) {
    const data = {
        status,
        updatedAt: Date.now(),
    };

    if (status === "on_break") {
        if (duration) {
            // Pausa determinada
            data.breakStartedAt = Date.now();
            data.breakDuration = duration;
            data.breakEndsAt = Date.now() + duration * 60 * 1000;
        } else {
            // Pausa indeterminada
            data.breakStartedAt = Date.now(); // Marca quando começou
            data.breakDuration = null;
            data.breakEndsAt = null;
        }
    } else if (status === "available") {
        data.breakStartedAt = null;
        data.breakDuration = null;
        data.breakEndsAt = null;
    }

    await setDoc(barberStatusDoc, data, { merge: true });
}

/**
 * Obtém o status atual do barbeiro
 */
export async function getBarberStatus() {
    const snapshot = await getDoc(barberStatusDoc);
    if (snapshot.exists()) {
        return snapshot.data();
    }
    // Status padrão se não existir
    return {
        status: "available",
        breakStartedAt: null,
        breakDuration: null,
        breakEndsAt: null,
        updatedAt: Date.now(),
    };
}

/**
 * Listener em tempo real para mudanças no status do barbeiro
 * @param {function} callback - Função chamada quando o status muda
 */
export function listenBarberStatus(callback) {
    return onSnapshot(barberStatusDoc, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.data());
        } else {
            // Criar documento inicial se não existir
            setBarberStatus("available").then(() => {
                callback({
                    status: "available",
                    breakStartedAt: null,
                    breakDuration: null,
                    breakEndsAt: null,
                    updatedAt: Date.now(),
                });
            });
        }
    });
}

/**
 * Finaliza a pausa manualmente
 */
export async function endBreak() {
    await setBarberStatus("available");
}

/**
 * Verifica se a pausa expirou e atualiza automaticamente
 */
export async function checkAndUpdateBreakStatus() {
    const status = await getBarberStatus();

    if (status.status === "on_break" && status.breakEndsAt) {
        const now = Date.now();
        if (now >= status.breakEndsAt) {
            await setBarberStatus("available");
            return true; // Pausa foi finalizada automaticamente
        }
    }

    return false;
}
