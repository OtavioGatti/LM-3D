"use client";

import { CheckCircle2, Clock, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function OrderConfirmationPanel() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const payment = searchParams.get("payment");

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
          <Clock aria-hidden="true" size={18} /> Pagamento: {payment ?? "pendente"}
        </span>
        <span>
          <MessageSquareText aria-hidden="true" size={18} /> Próximo passo: acompanhar em Minha conta
        </span>
      </div>

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
