"use client";

import { CheckCircle2, Clock, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { syncMercadoPagoPayment } from "@/lib/api/orders";

export function OrderConfirmationPanel() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? searchParams.get("external_reference");
  const initialPayment = searchParams.get("payment") ?? searchParams.get("status");
  const paymentId = useMemo(
    () => searchParams.get("payment_id") ?? searchParams.get("collection_id"),
    [searchParams]
  );
  const [paymentStatus, setPaymentStatus] = useState(initialPayment);
  const [syncMessage, setSyncMessage] = useState(
    paymentId ? "Conferindo confirmação do Mercado Pago..." : ""
  );

  useEffect(() => {
    let isMounted = true;

    async function syncPayment() {
      if (!code || !paymentId) {
        return;
      }

      try {
        const payload = await syncMercadoPagoPayment(code, paymentId);

        if (!isMounted) {
          return;
        }

        setPaymentStatus(payload.order.paymentStatus);
        setSyncMessage(
          payload.order.paymentStatus === "approved"
            ? "Pagamento confirmado. Seu pedido já aparece como pago em Minha conta."
            : "Recebemos o retorno do Mercado Pago e atualizamos o pedido."
        );
      } catch {
        if (!isMounted) {
          return;
        }

        setSyncMessage(
          "O pagamento foi aprovado no Mercado Pago. Se o status ainda aparecer pendente, aguarde alguns instantes ou atualize Minha conta."
        );
      }
    }

    void syncPayment();

    return () => {
      isMounted = false;
    };
  }, [code, paymentId]);

  return (
    <div className="page-container confirmation-panel">
      <CheckCircle2 aria-hidden="true" size={42} />
      <h1>Pedido recebido</h1>
      <p>
        {code
          ? `Anotamos o pedido ${code}.`
          : "Seu pedido foi recebido e ficará disponível para acompanhamento."}{" "}
        Se o pagamento já foi concluído no Mercado Pago, o status será atualizado automaticamente
        assim que a confirmação chegar.
      </p>

      <div className="checkout-steps">
        <span>
          <Clock aria-hidden="true" size={18} /> Pagamento: {paymentStatus ?? "pendente"}
        </span>
        <span>
          <MessageSquareText aria-hidden="true" size={18} /> Próximo passo: acompanhar em Minha conta
        </span>
      </div>

      {syncMessage ? <p className="form-note">{syncMessage}</p> : null}

      <div className="hero-actions">
        <Link href="/catalogo" className="button button-primary">
          Voltar ao catálogo
        </Link>
        <Link href="/conta" className="button button-secondary">
          Minha conta
        </Link>
      </div>
    </div>
  );
}
