import { useEffect, useState } from "react";
import { listenPayment, listenPixConfig, paymentIdFor } from "../services/pixService";

// Tela do cliente: configuração do Pix da barbearia + o pagamento dele (se já houver).
//   config   undefined = carregando, null = barbeiro não configurou
//   payment  undefined = carregando, null = ainda não enviou comprovante
// Sem `clientKey` (link antigo) não há como acompanhar o pagamento: payment fica null.
export function usePixPayment(barberId, clientId, clientKey) {
  const [config, setConfig] = useState(undefined);
  const [payment, setPayment] = useState(undefined);

  const paymentId = clientId && clientKey ? paymentIdFor(clientId, clientKey) : null;

  useEffect(() => {
    if (!barberId) return undefined;
    return listenPixConfig(
      barberId,
      setConfig,
      (error) => { console.error("Erro ao carregar a configuração do Pix:", error); setConfig(null); }
    );
  }, [barberId]);

  useEffect(() => {
    if (!barberId || !paymentId) { setPayment(null); return undefined; }
    setPayment(undefined);
    return listenPayment(
      barberId,
      paymentId,
      setPayment,
      (error) => { console.error("Erro ao acompanhar o pagamento:", error); setPayment(null); }
    );
  }, [barberId, paymentId]);

  return { config, payment, paymentId };
}
