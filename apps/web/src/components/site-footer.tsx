import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-container footer-grid">
        <div>
          <Link href="/" className="brand-mark">
            LM-3D
          </Link>
          <p>Produtos impressos em 3D com cuidado, clareza de prazo e atendimento direto.</p>
        </div>
        <div>
          <h2>Comprar</h2>
          <Link href="/catalogo">Catalogo</Link>
          <Link href="/pedido-personalizado">Pedido personalizado</Link>
          <Link href="/carrinho">Carrinho</Link>
        </div>
        <div>
          <h2>Lucas</h2>
          <Link href="/admin">Painel admin</Link>
          <span>Pagamentos via Mercado Pago nas proximas fases.</span>
        </div>
      </div>
    </footer>
  );
}
