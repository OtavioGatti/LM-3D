"use client";

import { formatMoneyBRL, type OrderStatus, type PaymentStatus } from "@lm-3d/shared";
import { PackageCheck, RefreshCw } from "lucide-react";
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
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  created_at: string;
  delivery_method: string | null;
  tracking_code: string | null;
  shipping_provider?: string | null;
  shipping_service_name?: string | null;
  shipping_company_name?: string | null;
  shipping_delivery_time_days?: number | null;
  customer_notes: string | null;
  order_items: AccountOrderItem[];
};

const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "Aguardando pagamento",
  paid: "Pago",
  payment_failed: "Pagamento falhou",
  in_production: "Em produção",
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
  charged_back: "Contestação"
};

function formatShippingLabel(order: AccountOrder) {
  if (order.shipping_provider === "pickup") {
    return "Retirada em Assis/SP";
  }

  if (order.shipping_provider === "melhor_envio") {
    return [order.shipping_company_name, order.shipping_service_name].filter(Boolean).join(" - ") || null;
  }

  return order.delivery_method;
}

const accountOrderBaseSelect = `
  id,
  code,
  status,
  payment_status,
  subtotal_cents,
  shipping_cents,
  discount_cents,
  total_cents,
  created_at,
  delivery_method,
  tracking_code,
  customer_notes,
  order_items (
    id,
    product_snapshot,
    quantity,
    unit_price_cents,
    line_total_cents,
    customization_notes
  )
`;

const accountOrderShippingSelect = `
  ${accountOrderBaseSelect},
  shipping_provider,
  shipping_service_name,
  shipping_company_name,
  shipping_delivery_time_days
`;

function isMissingShippingColumn(error: unknown) {
  return (
    error &&
    typeof error === "object" &&
    "message" in error &&
    /shipping_(provider|service|company|delivery)/.test(String(error.message))
  );
}

export function AccountOrders() {
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadOrders() {
    if (!hasSupabaseBrowserConfig()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("orders")
      .select(accountOrderShippingSelect)
      .order("created_at", { ascending: false });

    if (error) {
      if (!isMissingShippingColumn(error)) {
        setMessage(error.message);
        setIsLoading(false);
        return;
      }

      const fallback = await supabase
        .from("orders")
        .select(accountOrderBaseSelect)
        .order("created_at", { ascending: false });

      if (fallback.error) {
        setMessage(fallback.error.message);
      } else {
        setMessage("");
        setOrders((fallback.data ?? []) as unknown as AccountOrder[]);
      }
    } else {
      setMessage("");
      setOrders((data ?? []) as unknown as AccountOrder[]);
    }

    setIsLoading(false);
  }

  useEffect(() => {
    void loadOrders();

    function refreshOnFocus() {
      void loadOrders();
    }

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  return (
    <section className="account-orders">
      <div className="account-section-header">
        <div>
          <h2>Meus pedidos</h2>
          <p>Status, itens e próximos passos ficam reunidos aqui.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void loadOrders()}>
          <RefreshCw aria-hidden="true" size={16} />
          Atualizar status
        </button>
      </div>

      {message ? <p className="form-error">{message}</p> : null}
      {isLoading ? <p className="form-note">Carregando pedidos...</p> : null}

      {!isLoading && orders.length === 0 ? (
        <div className="empty-state">
          <PackageCheck aria-hidden="true" size={26} />
          <h2>Nenhum pedido vinculado ainda</h2>
          <p>Pedidos criados enquanto você estiver logado aparecem automaticamente aqui.</p>
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
            {formatShippingLabel(order) ? <span>{formatShippingLabel(order)}</span> : null}
            {order.shipping_delivery_time_days !== null &&
            order.shipping_delivery_time_days !== undefined ? (
              <span>Prazo: {order.shipping_delivery_time_days} dia(s) util(eis)</span>
            ) : null}
            {order.tracking_code ? <span>Rastreio: {order.tracking_code}</span> : null}
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

          {order.discount_cents > 0 || order.shipping_cents > 0 ? (
            <div className="account-order-totals">
              <span>Subtotal {formatMoneyBRL(order.subtotal_cents)}</span>
              {order.shipping_cents > 0 ? (
                <span>Frete {formatMoneyBRL(order.shipping_cents)}</span>
              ) : null}
              {order.discount_cents > 0 ? (
                <strong>Desconto -{formatMoneyBRL(order.discount_cents)}</strong>
              ) : null}
            </div>
          ) : null}

          {order.customer_notes ? <p>{order.customer_notes}</p> : null}
        </article>
      ))}
    </section>
  );
}
