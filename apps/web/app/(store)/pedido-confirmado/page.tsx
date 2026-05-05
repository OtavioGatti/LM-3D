import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Pedido confirmado"
};

export default function OrderConfirmedPage() {
  return (
    <section className="section">
      <div className="page-container confirmation-panel">
        <CheckCircle2 aria-hidden="true" size={42} />
        <h1>Pedido recebido</h1>
        <p>
          Quando o checkout estiver conectado, esta pagina exibira status de pagamento,
          proximos passos e informacoes de contato para pedidos personalizados.
        </p>
        <Link href="/catalogo" className="button button-primary">
          Voltar ao catalogo
        </Link>
      </div>
    </section>
  );
}
