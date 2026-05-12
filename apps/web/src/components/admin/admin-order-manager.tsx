"use client";

import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentStatus,
  formatMoneyBRL,
  getBrazilianPhoneHref,
  getBrazilianWhatsAppHref
} from "@lm-3d/shared";
import {
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Save,
  Search,
  Truck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminApiFetch } from "@/lib/api/admin";

type OrderItem = {
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

type DeliveryAddress = {
  line1?: string | null;
  number?: string | null;
  district?: string | null;
  complement?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
};

type AdminOrder = {
  id: string;
  code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  customer_notes: string | null;
  admin_notes: string | null;
  tracking_code: string | null;
  delivery_method: string | null;
  delivery_address: DeliveryAddress | null;
  shipping_provider?: string | null;
  shipping_service_id?: string | null;
  shipping_service_name?: string | null;
  shipping_company_name?: string | null;
  shipping_delivery_time_days?: number | null;
  shipping_origin_postal_code?: string | null;
  shipping_destination_postal_code?: string | null;
  shipping_melhor_envio_order_id?: string | null;
  shipping_melhor_envio_protocol?: string | null;
  shipping_melhor_envio_purchase_id?: string | null;
  shipping_melhor_envio_purchase_protocol?: string | null;
  shipping_melhor_envio_purchase_status?: string | null;
  shipping_label_status?: string | null;
  shipping_label_error?: string | null;
  created_at: string;
  order_items: OrderItem[];
  discount_coupon_redemptions?: Array<{
    id: string;
    discount_cents: number;
    discount_coupons: {
      code: string;
      name: string;
    } | null;
  }>;
};

const statusLabels: Record<OrderStatus, string> = {
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

function formatDeliveryAddress(order: AdminOrder) {
  const address = order.delivery_address;

  if (!address) {
    return "Endereço a combinar";
  }

  const street = [address.line1, address.number].filter(Boolean).join(", ");

  return [street, address.district, address.complement, address.city, address.state, address.postalCode]
    .filter(Boolean)
    .join(", ");
}

function getCouponLabel(order: AdminOrder) {
  const redemption = order.discount_coupon_redemptions?.[0];

  if (!redemption?.discount_coupons) {
    return null;
  }

  return `${redemption.discount_coupons.code} - ${redemption.discount_coupons.name}`;
}

function getShippingProviderLabel(order: AdminOrder) {
  if (order.shipping_provider === "pickup") {
    return "Retirada gratuita";
  }

  if (order.shipping_provider === "melhor_envio") {
    return [order.shipping_company_name, order.shipping_service_name].filter(Boolean).join(" - ") || null;
  }

  return null;
}

function getShippingLabelText(order: AdminOrder) {
  if (order.shipping_provider !== "melhor_envio") {
    return null;
  }

  if (order.shipping_label_status === "purchased") {
    return "Etiqueta comprada";
  }

  if (order.shipping_label_status === "cart_created") {
    return "Etiqueta no carrinho";
  }

  if (order.shipping_label_status === "creating" || order.shipping_label_status === "purchasing") {
    return "Sincronizando etiqueta";
  }

  if (order.shipping_label_status === "failed") {
    return "Falha na etiqueta";
  }

  return "Etiqueta pendente";
}

export function AdminOrderManager() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "todos">("todos");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "todos">("todos");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState("");
  const [checkingPaymentId, setCheckingPaymentId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadOrders() {
    setIsLoading(true);
    const payload = await adminApiFetch<{ orders: AdminOrder[] }>("/admin/orders");
    setOrders(payload.orders);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadOrders().catch((error: Error) => {
      setMessage(error.message);
      setIsLoading(false);
    });
  }, []);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus = status === "todos" || order.status === status;
      const matchesPayment = paymentStatus === "todos" || order.payment_status === paymentStatus;
      const matchesQuery =
        !normalized ||
        [order.code, order.customer_name, order.customer_email, order.customer_phone, order.tracking_code]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized));

      return matchesStatus && matchesPayment && matchesQuery;
    });
  }, [orders, paymentStatus, query, status]);

  useEffect(() => {
    if (expandedOrderId && !filteredOrders.some((order) => order.id === expandedOrderId)) {
      setExpandedOrderId(null);
    }
  }, [expandedOrderId, filteredOrders]);

  async function updateOrder(order: AdminOrder, updates: Partial<AdminOrder>) {
    setSavingId(order.id);
    setMessage("");

    try {
      const payload = {
        status: updates.status ?? order.status,
        payment_status: updates.payment_status ?? order.payment_status,
        admin_notes: updates.admin_notes ?? order.admin_notes,
        tracking_code: updates.tracking_code ?? order.tracking_code,
        delivery_method: updates.delivery_method ?? order.delivery_method
      };

      const response = await adminApiFetch<{ order: AdminOrder }>(`/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });

      setOrders((current) => current.map((item) => (item.id === order.id ? response.order : item)));
      setMessage(`Pedido ${order.code} atualizado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o pedido.");
    } finally {
      setSavingId("");
    }
  }

  async function verifyPayment(order: AdminOrder) {
    setCheckingPaymentId(order.id);
    setMessage("");

    try {
      const response = await adminApiFetch<{ order: AdminOrder; message: string }>(
        `/admin/orders/${order.id}/verify-payment`,
        {
          method: "POST"
        }
      );

      setOrders((current) => current.map((item) => (item.id === order.id ? response.order : item)));
      setMessage(response.message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel verificar o pagamento no Mercado Pago."
      );
    } finally {
      setCheckingPaymentId("");
    }
  }

  return (
    <section className="admin-panel admin-management-panel">
      <div className="catalog-toolbar order-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" size={18} />
          <input
            placeholder="Buscar pedido, cliente ou rastreio"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Status do pedido</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | "todos")}>
            <option value="todos">Todos</option>
            {ORDER_STATUSES.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Pagamento</span>
          <select
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus | "todos")}
          >
            <option value="todos">Todos</option>
            {PAYMENT_STATUSES.map((item) => (
              <option key={item} value={item}>
                {paymentStatusLabels[item]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message ? <p className="form-note">{message}</p> : null}
      {isLoading ? <p>Carregando pedidos...</p> : null}

      <div className="admin-order-summary-strip">
        <span>{filteredOrders.length} pedido(s) na visão atual</span>
        <strong>{formatMoneyBRL(filteredOrders.reduce((total, order) => total + order.total_cents, 0))}</strong>
      </div>

      <div className="admin-order-list">
        {filteredOrders.map((order) => {
          const isExpanded = expandedOrderId === order.id;
          const phoneHref = order.customer_phone ? getBrazilianPhoneHref(order.customer_phone) : null;
          const whatsappHref = order.customer_phone ? getBrazilianWhatsAppHref(order.customer_phone) : null;
          const firstItem = order.order_items[0];
          const extraItemsCount = Math.max(order.order_items.length - 1, 0);
          const itemSummary = firstItem
            ? `${firstItem.quantity}x ${firstItem.product_snapshot?.name ?? "Produto"}${
                extraItemsCount > 0 ? ` + ${extraItemsCount} item(ns)` : ""
              }`
            : "Sem itens registrados";

          return (
            <article className="admin-order-card" data-expanded={isExpanded} key={order.id}>
              <button
                aria-controls={`order-details-${order.id}`}
                aria-expanded={isExpanded}
                className="admin-order-summary-button"
                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                type="button"
              >
                <span className="admin-order-summary-main">
                  <strong>{order.code}</strong>
                  <span>
                    {order.customer_name} · {order.customer_email}
                  </span>
                  {order.customer_phone ? <small>{order.customer_phone}</small> : null}
                  <small>{itemSummary}</small>
                </span>
                <span className="admin-order-summary-meta">
                  <strong>{formatMoneyBRL(order.total_cents)}</strong>
                  <span>{new Intl.DateTimeFormat("pt-BR").format(new Date(order.created_at))}</span>
                  <span className="admin-order-summary-status">
                    <span className="status-pill">{statusLabels[order.status]}</span>
                    <span className="status-pill">{paymentStatusLabels[order.payment_status]}</span>
                  </span>
                </span>
                <span className="admin-order-expand-copy">
                  {isExpanded ? (
                    <ChevronUp aria-hidden="true" size={18} />
                  ) : (
                    <ChevronDown aria-hidden="true" size={18} />
                  )}
                  {isExpanded ? "Minimizar" : "Ver detalhes"}
                </span>
              </button>

              {isExpanded ? (
                <div className="admin-order-expanded-content" id={`order-details-${order.id}`}>
                  <div className="admin-contact-actions">
                    <a className="text-link" href={`mailto:${order.customer_email}`}>
                      <Mail aria-hidden="true" size={16} />
                      E-mail
                    </a>
                    {phoneHref || whatsappHref ? (
                      <>
                        {phoneHref ? (
                          <a className="text-link" href={phoneHref}>
                            <Phone aria-hidden="true" size={16} />
                            Ligar
                          </a>
                        ) : null}
                        {whatsappHref ? (
                          <a className="text-link" href={whatsappHref} rel="noreferrer" target="_blank">
                            <MessageCircle aria-hidden="true" size={16} />
                            WhatsApp
                          </a>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  <div className="order-items-list">
                    {order.order_items.map((item) => (
                      <div key={item.id}>
                        <span>
                          {item.quantity}x {item.product_snapshot?.name ?? "Produto"}
                        </span>
                        <strong>{formatMoneyBRL(item.line_total_cents)}</strong>
                        {item.customization_notes ? <small>{item.customization_notes}</small> : null}
                      </div>
                    ))}
                  </div>

                  <div className="admin-order-details-grid">
                    <div>
                      <span>Entrega</span>
                      <strong>{getShippingProviderLabel(order) ?? order.delivery_method ?? "A combinar"}</strong>
                      <small>{formatDeliveryAddress(order)}</small>
                      {order.shipping_delivery_time_days !== null &&
                      order.shipping_delivery_time_days !== undefined ? (
                        <small>Prazo: {order.shipping_delivery_time_days} dia(s) util(eis)</small>
                      ) : null}
                      {order.shipping_destination_postal_code ? (
                        <small>CEP destino: {order.shipping_destination_postal_code}</small>
                      ) : null}
                      {getShippingLabelText(order) ? (
                        <small>Melhor Envio: {getShippingLabelText(order)}</small>
                      ) : null}
                      {order.shipping_melhor_envio_order_id ? (
                        <small>ME pedido: {order.shipping_melhor_envio_order_id}</small>
                      ) : null}
                      {order.shipping_melhor_envio_protocol ? (
                        <small>ME protocolo: {order.shipping_melhor_envio_protocol}</small>
                      ) : null}
                      {order.shipping_melhor_envio_purchase_protocol ? (
                        <small>Compra ME: {order.shipping_melhor_envio_purchase_protocol}</small>
                      ) : null}
                      {order.shipping_label_error ? (
                        <small>Erro ME: {order.shipping_label_error}</small>
                      ) : null}
                      {order.tracking_code ? <small>Rastreio: {order.tracking_code}</small> : null}
                    </div>
                    <div>
                      <span>Totais</span>
                      <small>Subtotal: {formatMoneyBRL(order.subtotal_cents)}</small>
                      {order.discount_cents > 0 ? (
                        <small>
                          Desconto: -{formatMoneyBRL(order.discount_cents)}
                          {getCouponLabel(order) ? ` (${getCouponLabel(order)})` : ""}
                        </small>
                      ) : null}
                      {order.shipping_cents > 0 ? <small>Entrega: {formatMoneyBRL(order.shipping_cents)}</small> : null}
                      <strong>Total: {formatMoneyBRL(order.total_cents)}</strong>
                    </div>
                    <div>
                      <span>Observação do cliente</span>
                      <small>{order.customer_notes || "Sem observações do cliente."}</small>
                    </div>
                  </div>

                  <div className="form-grid">
                    <label>
                      Status do pedido
                      <select
                        value={order.status}
                        onChange={(event) => void updateOrder(order, { status: event.target.value as OrderStatus })}
                      >
                        {ORDER_STATUSES.map((item) => (
                          <option key={item} value={item}>
                            {statusLabels[item]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status do pagamento
                      <select
                        value={order.payment_status}
                        onChange={(event) =>
                          void updateOrder(order, { payment_status: event.target.value as PaymentStatus })
                        }
                      >
                        {PAYMENT_STATUSES.map((item) => (
                          <option key={item} value={item}>
                            {paymentStatusLabels[item]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Entrega/retirada
                      <input
                        defaultValue={order.delivery_method ?? ""}
                        onBlur={(event) => void updateOrder(order, { delivery_method: event.target.value })}
                        placeholder="Ex.: Retirada, Correios, motoboy"
                      />
                    </label>
                    <label>
                      Código de rastreio
                      <input
                        defaultValue={order.tracking_code ?? ""}
                        onBlur={(event) => void updateOrder(order, { tracking_code: event.target.value })}
                      />
                    </label>
                    <label>
                      Observação interna
                      <textarea
                        defaultValue={order.admin_notes ?? ""}
                        onBlur={(event) => void updateOrder(order, { admin_notes: event.target.value })}
                        rows={3}
                      />
                    </label>
                  </div>

                  <div className="admin-inline-actions">
                    <button
                      className="secondary-button"
                      disabled={checkingPaymentId === order.id}
                      onClick={() => void verifyPayment(order)}
                      type="button"
                    >
                      <RefreshCw aria-hidden="true" size={14} />
                      {checkingPaymentId === order.id ? "Verificando..." : "Verificar pagamento"}
                    </button>
                    <span className="status-pill">{statusLabels[order.status]}</span>
                    <span className="status-pill">{paymentStatusLabels[order.payment_status]}</span>
                    {(getShippingProviderLabel(order) ?? order.delivery_method) ? (
                      <span className="status-pill">
                        <Truck aria-hidden="true" size={14} />
                        {getShippingProviderLabel(order) ?? order.delivery_method}
                      </span>
                    ) : null}
                    {getShippingLabelText(order) ? (
                      <span className="status-pill">{getShippingLabelText(order)}</span>
                    ) : null}
                    {savingId === order.id ? (
                      <span className="saving-pill">
                        <Save aria-hidden="true" size={14} />
                        Salvando
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!isLoading && filteredOrders.length === 0 ? (
        <div className="empty-state">
          <h2>Nenhum pedido encontrado</h2>
          <p>Quando pedidos forem criados, eles aparecerão aqui para acompanhar produção e entrega.</p>
        </div>
      ) : null}
    </section>
  );
}
