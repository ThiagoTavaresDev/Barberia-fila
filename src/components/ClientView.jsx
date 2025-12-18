import React, { useEffect, useState, useRef } from "react";
import { Scissors, Users, Clock, Bell, Instagram, Star } from "lucide-react";
import confetti from "canvas-confetti";
import {
  getClientPosition,
  calculateEstimatedWait,
  formatDuration,
  requestNotificationPermission,
  sendNotification,
} from "../utils/helpers";
import { submitRating, listenQueue } from "../services/queueService";
import { listenBarberStatus } from "../services/barberStatus";
import tadaSound from "../sounds/ta-da.mp3";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function ClientView({ queue: propQueue = [], clientId, barberId }) {
  // State Definitions (Must be first)
  const [localQueue, setLocalQueue] = useState([]);
  const [notificationPermission, setNotificationPermission] = useState(
    Notification.permission === "granted"
  );

  // Use local queue if available (self-fetched), otherwise use props
  // We prioritize localQueue if it has data, as it means the component successfully connected itself
  const queue = localQueue.length > 0 ? localQueue : propQueue;

  const [rating, setRating] = useState(0);
  const [hasRated, setHasRated] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [barberStatus, setBarberStatus] = useState({ status: 'available' });
  const [instagramLink, setInstagramLink] = useState("");

  // Status Verification State (Race Condition Fix)
  const [isVerifying, setIsVerifying] = useState(() => {
    // Initial state: If we have an ID but it's not in the queue, assume we need to verify
    return !!clientId && !queue.find(c => c.id === clientId);
  });
  // Temporary client data while waiting for queue sync
  const [tempClient, setTempClient] = useState(null);

  // Refs
  const hasCelebratedRef = useRef(false);

  // Derived State (Depends on Props + State)
  // Use queue client if available, otherwise fallback to tempClient (from individual fetch)
  const client = queue.find((c) => c.id === clientId) || tempClient;
  const position = clientId ? getClientPosition(queue, clientId) : 0;
  // If we are using tempClient, we don't know the index yet, so position is approximate/unknown
  // getClientPosition handles missing client by returning 0, which is fine for "Waiting..." state
  const clientIndex = queue.findIndex((c) => c.id === clientId);


  // QUEUE LISTENER FALLBACK (Self-Healing)
  // If we have a barberId, ensure we are listening to the queue directly
  // This solves issues where App.jsx might fail to pass the queue or routing is complex
  useEffect(() => {
    if (barberId) {
      console.log("ClientView: Starting independent queue listener for", barberId);
      const unsubscribe = listenQueue(barberId, (newQueue) => {
        console.log("ClientView: Local queue updated", newQueue.length);
        setLocalQueue(newQueue);
      });
      return () => unsubscribe();
    }
  }, [barberId]);


  useEffect(() => {
    const clientInQueue = queue.find(c => c.id === clientId);

    // If client is found in REAL queue, we are good.
    if (clientInQueue) {
      setIsVerifying(false);
      setTempClient(null);
      return;
    }

    // If we have an ID but not in queue, and haven't verified yet (or lost tempClient)
    if (clientId && !clientInQueue && !tempClient) {
      setIsVerifying(true);
      const verifyStatus = async () => {
        try {
          console.log(`Verifying status for client ${clientId} on barber ${barberId}...`);
          const docRef = doc(db, "users", barberId, "queue", clientId);
          const snap = await getDoc(docRef);

          if (snap.exists()) {
            const data = snap.data();
            console.log("Client found directly:", data);

            if (data.status === 'waiting') {
              setTempClient({ id: snap.id, ...data });
              setIsVerifying(false);
              return;
            }
          } else {
            console.warn("Client document not found directly.");
          }

          setIsVerifying(false);
          setTempClient(null);
        } catch (error) {
          console.error("Verification error:", error);
          // If permission error, it means Rules are wrong or blocked
          if (error.code === 'permission-denied') {
            alert("Erro de permissão: As regras do Firebase podem não estar publicadas. Verifique o console.");
          }
          setIsVerifying(false);
        }
      };
      verifyStatus();
    }
  }, [clientId, queue, barberId, tempClient]);

  useEffect(() => {
    if (!barberId) return;
    const unsubscribe = listenBarberStatus(barberId, setBarberStatus);

    // Buscar perfil do barbeiro
    const fetchBarberProfile = async () => {
      try {
        const docRef = doc(db, "users", barberId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setInstagramLink(data.instagramLink || "");
          if (data.shopName) {
            document.title = data.shopName;
          }
        }
      } catch (error) {
        console.error("Error fetching barber profile:", error);
      }
    };
    fetchBarberProfile();

    return () => unsubscribe();
  }, [barberId]);

  // Calcular tempo estimado de espera (soma dos serviços anteriores)
  let estimatedWaitMinutes = calculateEstimatedWait(queue, clientIndex);

  // Se o barbeiro estiver em pausa determinada, adicionar o tempo restante
  if (barberStatus.status === 'on_break' && barberStatus.breakEndsAt) {
    const remainingBreak = Math.max(0, Math.ceil((barberStatus.breakEndsAt - Date.now()) / 60000));
    estimatedWaitMinutes += remainingBreak;
  }

  // Solicitar permissão de notificação ao carregar
  useEffect(() => {
    if (clientId) {
      requestNotificationPermission().then(setNotificationPermission);
    }
  }, [clientId]);

  // Efeitos quando chega a vez (Posição 1)
  useEffect(() => {
    if (position === 1 && barberStatus.status !== 'on_break') {
      // Notificação
      if (notificationPermission) {
        sendNotification(
          "É a sua vez!",
          "Dirija-se à cadeira do barbeiro para o seu atendimento."
        );
      }

      // Celebração (Confete + Som)
      if (!hasCelebratedRef.current) {
        hasCelebratedRef.current = true;

        // Confete
        const duration = 1500;
        const end = Date.now() + duration;

        const frame = () => {
          // Cores laranja (Amber do Tailwind)
          const colors = ['#f59e0b', '#d97706', '#b45309'];

          confetti({
            particleCount: 1,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors,
          });
          confetti({
            particleCount: 1,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors,
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();

        // Som
        const audio = new Audio(tadaSound);
        audio.volume = 0.5;
        audio.play().catch((e) => console.log("Audio play failed (user interaction needed first):", e));
      }
    } else {
      // Resetar flag se sair da posição 1
      hasCelebratedRef.current = false;
    }
  }, [position, notificationPermission, barberStatus.status]);

  const handleEnableNotifications = async () => {
    try {
      const granted = await requestNotificationPermission();
      setNotificationPermission(granted);

      if (granted) {
        sendNotification("Notificações Ativadas", "Você será avisado quando chegar sua vez!");
        try {
          const audio = new Audio(tadaSound);
          audio.volume = 0.5;
          await audio.play();
        } catch (audioError) {
          console.log("Audio test failed:", audioError);
        }
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
      alert("Não foi possível ativar as notificações. Verifique as permissões do seu navegador.");
    }
  };

  const handleRatingSubmit = async () => {
    if (rating === 0) {
      alert("Por favor, selecione uma avaliação antes de enviar.");
      return;
    }

    setIsSubmittingRating(true);
    try {
      await submitRating(barberId, clientId, rating);
      setHasRated(true);
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("Erro ao enviar avaliação. Tente novamente.");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // Cliente não está na fila (e não está esperando sincronização)
  // Se tiver tempClient (status waiting), DEIXA PASSAR para exibir o painel
  if (!clientId || (position === 0 && (!client || client.status !== 'waiting'))) {
    if (isVerifying) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-white">Localizando seu agendamento...</h2>
          </div>
        </div>
      );
    }

    if (!hasRated && client && client.status === "done" && !client.rating) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Scissors className="w-10 h-10 text-green-500" />
            </div>

            <h2 className="text-2xl font-bold text-white">
              Atendimento Concluído!
            </h2>

            <p className="text-gray-300 text-lg">
              Como foi sua experiência?
            </p>

            {/* Rating Stars */}
            <div className="flex justify-center gap-2 py-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-all duration-200 transform hover:scale-110"
                >
                  <Star
                    className={`w-12 h-12 ${star <= rating
                      ? "fill-amber-500 text-amber-500"
                      : "text-gray-600 hover:text-amber-500"
                      }`}
                  />
                </button>
              ))}
            </div>

            <button
              onClick={handleRatingSubmit}
              disabled={isSubmittingRating || rating === 0}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg transition-all duration-200"
            >
              {isSubmittingRating ? "Enviando..." : "Enviar Avaliação"}
            </button>

            {instagramLink && (
              <div className="pt-4">
                <a
                  href={instagramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <Instagram className="w-6 h-6" />
                  <span>Siga nosso Instagram</span>
                </a>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Scissors className="w-10 h-10 text-amber-500" />
          </div>

          <h2 className="text-2xl font-bold text-white">
            {hasRated ? "Obrigado pela avaliação!" : "Atendimento Finalizado"}
          </h2>

          <p className="text-gray-300 text-lg leading-relaxed">
            {hasRated
              ? "Sua opinião é muito importante para nós!"
              : "Obrigado pela confiança no nosso serviço, até o próximo atendimento!"
            }
          </p>

          {instagramLink && (
            <div className="pt-4">
              <a
                href={instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 rounded-xl shadow-lg transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Instagram className="w-6 h-6" />
                <span>Siga nosso Instagram</span>
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Se o barbeiro estiver em pausa indeterminada
  if (barberStatus.status === 'on_break' && !barberStatus.breakEndsAt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            Pausa no Atendimento
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed">
            O barbeiro precisou fazer uma breve pausa. <br />
            Voltaremos ao atendimento normal em instantes.
          </p>
          <div className="bg-gray-700/50 p-4 rounded-lg">
            <p className="text-sm text-gray-400">
              Sua posição na fila está garantida: <span className="text-white font-bold">{position}º</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="bg-gray-800 rounded-xl p-8 text-center space-y-6">
          <Scissors className="w-16 h-16 mx-auto text-amber-500" />
          <h2 className="text-3xl font-bold text-white">Olá, {client.name}!</h2>

          <div
            className={`relative overflow-hidden rounded-xl p-8 ${position === 1
              ? "bg-gradient-to-r from-green-600 to-green-500"
              : "bg-gradient-to-r from-amber-600 to-amber-500"
              }`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>

            <p className="text-amber-100 text-sm uppercase tracking-wide mb-2 relative z-10">
              Sua posição na fila
            </p>

            <p className="text-6xl font-bold text-white relative z-10">
              {position > 0 ? `${position}º` : "--"}
            </p>
            {position === 0 && (
              <p className="text-xs text-amber-200 mt-2 relative z-10 animate-pulse">
                Sincronizando fila...
              </p>
            )}
          </div>

          <div className="space-y-3 text-left">
            <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-amber-500" />
                <span className="text-gray-300">Pessoas na sua frente</span>
              </div>
              <span className="text-white font-bold">{position - 1}</span>
            </div>

            <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500" />
                <span className="text-gray-300">Tempo estimado</span>
              </div>
              <div className="text-right">
                <span className="text-white font-bold block">
                  {position === 1 && barberStatus.status !== 'on_break'
                    ? "É a sua vez!"
                    : formatDuration(estimatedWaitMinutes)}
                </span>
                {position > 1 && (
                  <span className="text-xs text-gray-400">
                    Previsão: {new Date(Date.now() + estimatedWaitMinutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>

            {barberStatus.status === 'on_break' && barberStatus.breakEndsAt && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                <p className="text-amber-200 text-sm">
                  ⚠️ O barbeiro está em uma pausa programada. O tempo estimado já inclui essa pausa.
                </p>
              </div>
            )}
          </div>

          {!notificationPermission && (
            <button
              onClick={handleEnableNotifications}
              className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-500/20 transform transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 group"
            >
              <Bell className="w-6 h-6 group-hover:animate-bounce" />
              <span className="text-lg">Ativar Notificações e Som</span>
            </button>
          )}

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">
              A fila é atualizada automaticamente. Mantenha esta página aberta
              para acompanhar sua posição em tempo real.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
