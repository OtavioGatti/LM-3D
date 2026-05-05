import Link from "next/link";
import { CircleDollarSign, Package, ShoppingBag, TimerReset } from "lucide-react";

const stats = [
  { label: "Produtos ativos", value: "24", icon: Package },
  { label: "Pedidos recentes", value: "8", icon: ShoppingBag },
  { label: "Faturamento estimado", value: "R$ 1.840", icon: CircleDollarSign },
  { label: "Pagamentos pendentes", value: "3", icon: TimerReset }
];

export default function AdminDashboardPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visao inicial do painel do Lucas. Dados reais entram apos Supabase e pedidos.</p>
        </div>
        <Link href="/admin/produtos" className="button button-primary">
          Adicionar produto
        </Link>
      </div>

      <div className="admin-stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="admin-stat-card" key={stat.label}>
              <Icon aria-hidden="true" size={22} />
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          );
        })}
      </div>

      <section className="admin-panel">
        <h2>Pedidos recentes</h2>
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Status</span>
            <span>Total</span>
          </div>
          {[
            ["LM-1004", "Marina", "Aguardando pagamento", "R$ 89,90"],
            ["LM-1003", "Rafael", "Em producao", "R$ 132,00"],
            ["LM-1002", "Bianca", "Pago", "R$ 54,90"]
          ].map((row) => (
            <div className="admin-table-row" key={row[0]}>
              {row.map((cell) => (
                <span key={cell}>{cell}</span>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
