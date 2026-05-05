import Link from "next/link";
import { ArrowRight, Clock, ShieldCheck } from "lucide-react";
import { products } from "@/data/demo-catalog";
import { formatMoneyBRL } from "@lm-3d/shared";

export const metadata = {
  title: "Carrinho"
};

export default function CartPage() {
  const item = products[0]!;
  const subtotal = item.priceInCents;

  return (
    <section className="section">
      <div className="page-container cart-layout">
        <div>
          <h1>Carrinho</h1>
          <p className="page-intro">
            Estrutura visual da etapa de carrinho. A persistencia e as quantidades entram na Fase 6.
          </p>

          <article className="cart-item">
            <img src={item.image.src} alt={item.image.alt} />
            <div>
              <h2>{item.name}</h2>
              <p>{item.shortDescription}</p>
              <label>
                Observacoes de personalizacao
                <textarea placeholder="Ex.: nome, cor preferida, detalhe desejado..." rows={4} />
              </label>
            </div>
            <div className="cart-item-price">
              <span>Qtd. 1</span>
              <strong>{formatMoneyBRL(item.priceInCents)}</strong>
            </div>
          </article>
        </div>

        <aside className="order-summary">
          <h2>Resumo</h2>
          <div className="summary-line">
            <span>Subtotal</span>
            <strong>{formatMoneyBRL(subtotal)}</strong>
          </div>
          <div className="summary-line">
            <span>Entrega ou retirada</span>
            <strong>A combinar</strong>
          </div>
          <div className="summary-total">
            <span>Total estimado</span>
            <strong>{formatMoneyBRL(subtotal)}</strong>
          </div>
          <Link href="/checkout" className="button button-primary full-width">
            Finalizar compra
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
          <div className="summary-note">
            <Clock aria-hidden="true" size={18} />
            Produtos sob encomenda podem ter prazo de producao antes do envio.
          </div>
          <div className="summary-note">
            <ShieldCheck aria-hidden="true" size={18} />
            Na integracao final, o pagamento sera criado com preco recalculado no backend.
          </div>
        </aside>
      </div>
    </section>
  );
}
