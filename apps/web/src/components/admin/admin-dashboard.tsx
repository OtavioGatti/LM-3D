"use client";

import { formatMoneyBRL, type OrderStatus } from "@lm-3d/shared";
import { CircleDollarSign, ClipboardList, Package, ShoppingBag, TimerReset } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminApiFetch } from "@/lib/api/admin";

type DashboardProduct = {
  id: string;
  status: string;
};

type DashboardOrder = {
  id: string;
  code: string;
  customer_name: string;
  status: OrderStatus;
  payment_status: string;
  total_cents: number;
  created_at: string;
};

type DashboardCustomRequest = {
  id: string;
  code: string;
  title: string;
  customer_name: string;
  status: string;
  created_at: string;
};

const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  payment_failed: "Pagamento falhou",
  in_production: "Em producao",
  ready: "Pronto",
  shipped: "Enviado",
  delivered: "Entregue",
  canceled: "Cancelado",
  refunded: "Reembolsado"
};

export function AdminDashboard() {
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [requests, setRequests] = useState<DashboardCustomRequest[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      const [productsPayload, ordersPayload, requestsPayload] = await Promise.all([
        adminApiFetch<{ products: DashboardProduct[] }>("/admin/products"),
        adminApiFetch<{ orders: DashboardOrder[] }>("/admin/orders"),
        adminApiFetch<{ requests: DashboardCustomRequest[] }>("/admin/custom-requests")
      ]);

      setProducts(productsPayload.products);
      setOrders(ordersPayload.orders);
      setRequests(requestsPayload.requests);
      setIsLoading(false);
    }

    void loadDashboard().catch((error: Error) => {
      setMessage(error.message);
      setIsLoading(false);
    });
  }, []);

  const stats = useMemo(() => {
    const activeProducts = products.filter((product) =>
      ["active", "made_to_order"].includes(product.status)
    ).length;
    const recentOrders = orders.length;
    const estimatedRevenue = orders
      .filter((order) => !["canceled", "refunded"].includes(order.status))
      .reduce((total, order) => total + order.total_cents, 0);
    const pendingPayments = orders.filter((order) => order.payment_status === "pending").length;
    const newRequests = requests.filter((request) => request.status === "new").length;

    return [
      { label: "Produtos ativos", value: String(activeProducts), icon: Package },
      { label: "Pedidos recentes", value: String(recentOrders), icon: ShoppingBag },
      { label: "Faturamento estimado", value: formatMoneyBRL(estimatedRevenue), icon: CircleDollarSign },
      { label: "Pagamentos pendentes", value: String(pendingPayments), icon: TimerReset },
      { label: "Orcamentos novos", value: String(newRequests), icon: ClipboardList }
    ];
  }, [orders, products, requests]);

  const latestOrders = orders.slice(0, 5);
  const latestRequests = requests.slice(0, 4);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visao operacional com produtos, pedidos e orcamentos reais da LM-3D.</p>
        </div>
        <div className="admin-inline-actions">
          <Link href="/admin/orcamentos" className="button button-secondary">
            Ver orcamentos
          </Link>
          <Link href="/admin/produtos" className="button button-primary">
            Adicionar produto
          </Link>
        </div>
      </div>

      {message ? <p className="form-error">{message}</p> : null}
      {isLoading ? <p className="form-note">Carregando dashboard...</p> : null}

      <div className="admin-stats-grid dashboard-stats-grid">
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

      <div className="dashboard-panels">
        <section className="admin-panel">
          <div className="admin-management-header">
            <div>
              <h2>Pedidos recentes</h2>
              <p>Ultimos pedidos criados no checkout.</p>
            </div>
            <Link href="/admin/pedidos" className="text-link">
              Ver todos
            </Link>
          </div>
          <div className="admin-table">
            <div className="admin-table-row admin-table-head">
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Status</span>
              <span>Total</span>
            </div>
            {latestOrders.map((order) => (
              <div className="admin-table-row" key={order.id}>
                <span>{order.code}</span>
                <span>{order.customer_name}</span>
                <span>{orderStatusLabels[order.status]}</span>
                <span>{formatMoneyBRL(order.total_cents)}</span>
              </div>
            ))}
          </div>
          {!isLoading && latestOrders.length === 0 ? (
            <div className="empty-state">
              <h2>Nenhum pedido ainda</h2>
              <p>Quando o checkout criar pedidos, eles aparecem aqui.</p>
            </div>
          ) : null}
        </section>

        <section className="admin-panel">
          <div className="admin-management-header">
            <div>
              <h2>Orcamentos novos</h2>
              <p>Ideias personalizadas enviadas pela vitrine.</p>
            </div>
            <Link href="/admin/orcamentos" className="text-link">
              Ver fila
            </Link>
          </div>
          <div className="dashboard-request-list">
            {latestRequests.map((request) => (
              <article key={request.id}>
                <strong>{request.title}</strong>
                <span>
                  {request.code} · {request.customer_name}
                </span>
                <small>{request.status}</small>
              </article>
            ))}
          </div>
          {!isLoading && latestRequests.length === 0 ? (
            <div className="empty-state">
              <h2>Nenhum orcamento ainda</h2>
              <p>Solicitacoes personalizadas entram nesta fila.</p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
