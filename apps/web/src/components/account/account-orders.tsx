"use client";

import { formatMoneyBRL, type OrderStatus, type PaymentStatus } from "@lm-3d/shared";
import { PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type AccountOrderItem = {
  id: string;
  product_snapshot: {
    name?: string;
    slug?: string;
  };
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  customization_notes: string | null;
};

type AccountOrder = {
  id: string;
  code: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_cents: number;
  created_at: string;
  customer_notes: string | null;
  order_items: AccountOrderItem[];
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

const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  charged_back: "Contestacao"
};

export function AccountOrders() {
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      if (!hasSupabaseBrowserConfig()) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await getSupabaseBrowserClient()
        .from("orders")
        .select(
          `
          id,
          code,
          status,
          payment_status,
          total_cents,
          created_at,
          customer_notes,
          order_items (
            id,
            product_snapshot,
            quantity,
            unit_price_cents,
            line_total_cents,
            customization_notes
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        setMessage(error.message);
      } else {
        setOrders((data ?? []) as unknown as AccountOrder[]);
      }

      setIsLoading(false);
    }

    void loadOrders();
  }, []);

  return (
    <section className="account-orders">
      <div className="account-section-header">
        <div>
          <h2>Meus pedidos</h2>
          <p>Status, itens e proximos passos ficam reunidos aqui.</p>
        </div>
      </div>

      {message ? <p className="form-error">{message}</p> : null}
      {isLoading ? <p className="form-note">Carregando pedidos...</p> : null}

      {!isLoading && orders.length === 0 ? (
        <div className="empty-state">
          <PackageCheck aria-hidden="true" size={26} />
          <h2>Nenhum pedido vinculado ainda</h2>
          <p>Pedidos criados enquanto voce estiver logado aparecem automaticamente aqui.</p>
        </div>
      ) : null}

      {orders.map((order) => (
        <article className="account-order-card" key={order.id}>
          <header>
            <div>
              <strong>{order.code}</strong>
              <span>{new Intl.DateTimeFormat("pt-BR").format(new Date(order.created_at))}</span>
            </div>
            <strong>{formatMoneyBRL(order.total_cents)}</strong>
          </header>

          <div className="checkout-assurance">
            <span>{orderStatusLabels[order.status]}</span>
            <span>Pagamento: {paymentStatusLabels[order.payment_status]}</span>
          </div>

          <div className="account-order-items">
            {order.order_items.map((item) => (
              <div key={item.id}>
                <span>
                  {item.quantity} x {item.product_snapshot.name ?? "Produto"}
                </span>
                <strong>{formatMoneyBRL(item.line_total_cents)}</strong>
                {item.customization_notes ? <small>{item.customization_notes}</small> : null}
              </div>
            ))}
          </div>

          {order.customer_notes ? <p>{order.customer_notes}</p> : null}
        </article>
      ))}
    </section>
  );
}
