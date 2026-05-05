import Link from "next/link";
import { LockKeyhole, ServerCog } from "lucide-react";

export const metadata = {
  title: "Checkout"
};

export default function CheckoutPage() {
  return (
    <section className="section">
      <div className="page-container checkout-placeholder">
        <LockKeyhole aria-hidden="true" size={36} />
        <h1>Checkout seguro</h1>
        <p>
          Esta rota ja esta reservada para a Fase 7. O pedido sera criado no backend,
          o valor sera recalculado no banco e a preferencia de pagamento sera gerada
          pela API do Mercado Pago sem expor credenciais no frontend.
        </p>
        <div className="checkout-steps">
          <span>
            <ServerCog aria-hidden="true" size={18} /> Criar pedido na API
          </span>
          <span>Redirecionar para Mercado Pago</span>
          <span>Confirmar pagamento por webhook</span>
        </div>
        <Link href="/pedido-confirmado" className="button button-secondary">
          Ver estado de confirmacao
        </Link>
      </div>
    </section>
  );
}
