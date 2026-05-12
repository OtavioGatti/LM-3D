import type { PaymentStatus } from "@lm-3d/shared";
import {
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  mapMercadoPagoOrderStatus,
  mapMercadoPagoPaymentStatus,
  type MercadoPagoPaymentResponse,
  type MercadoPagoPreferenceItem
} from "./mercado-pago.js";
import { HttpError } from "./http.js";
import { ensureMelhorEnvioShipmentForPaidOrder } from "./order-shipping.js";
import type { SupabaseAdminClient } from "./supabase.js";

type OrderPaymentInput = {
  supabase: SupabaseAdminClient;
  order: {
    id: string;
    code: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    total_cents: number;
  };
  items: MercadoPagoPreferenceItem[];
};

type ExistingPayment = {
  id: string;
  mercado_pago_preference_id: string | null;
  status: PaymentStatus;
  raw_payload: {
    checkout_url?: string | null;
    sandbox_checkout_url?: string | null;
  } | null;
};

type SyncableOrder = {
  id: string;
  code: string;
  total_cents: number;
};

type PaymentRow = {
  id: string;
};

export async function ensureMercadoPagoPreferenceForOrder({
  supabase,
  order,
  items
}: OrderPaymentInput) {
  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from("payments")
    .select("id, mercado_pago_preference_id, status, raw_payload")
    .eq("order_id", order.id)
    .maybeSingle();

  if (existingPaymentError) {
    throw existingPaymentError;
  }

  const storedPayment = existingPayment as ExistingPayment | null;
  const storedCheckoutUrl = storedPayment?.raw_payload?.checkout_url ?? null;

  if (storedPayment?.mercado_pago_preference_id && storedCheckoutUrl) {
    return {
      id: storedPayment.mercado_pago_preference_id,
      checkoutUrl: storedCheckoutUrl,
      sandboxCheckoutUrl: storedPayment.raw_payload?.sandbox_checkout_url ?? null,
      rawPayload: storedPayment.raw_payload
    };
  }

  const preference = await createMercadoPagoPreference({
    orderId: order.id,
    orderCode: order.code,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    totalCents: order.total_cents,
    items
  });

  const paymentPayload = {
    order_id: order.id,
    provider: "mercado_pago",
    mercado_pago_preference_id: preference.id,
    external_reference: order.code,
    status: "pending",
    amount_cents: order.total_cents,
    currency: "BRL",
    raw_payload: {
      preference: preference.rawPayload,
      checkout_url: preference.checkoutUrl,
      sandbox_checkout_url: preference.sandboxCheckoutUrl
    }
  };

  if (storedPayment) {
    const { error } = await supabase
      .from("payments")
      .update(paymentPayload)
      .eq("id", storedPayment.id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from("payments").insert(paymentPayload);

    if (error) {
      throw error;
    }
  }

  return preference;
}

export async function findCustomRequestIdForOrder(
  supabase: SupabaseAdminClient,
  orderId: string
) {
  const { data, error } = await supabase
    .from("order_items")
    .select("product_snapshot")
    .eq("order_id", orderId);

  if (error) {
    throw error;
  }

  for (const item of data ?? []) {
    const snapshot = item.product_snapshot as { custom_request_id?: unknown } | null;

    if (typeof snapshot?.custom_request_id === "string") {
      return snapshot.custom_request_id;
    }
  }

  return null;
}

function getPaymentOrderCode(payment: MercadoPagoPaymentResponse) {
  return (
    payment.external_reference ??
    (typeof payment.metadata?.order_code === "string" ? payment.metadata.order_code : null)
  );
}

export async function applyMercadoPagoPaymentToOrder({
  supabase,
  order,
  payment
}: {
  supabase: SupabaseAdminClient;
  order: SyncableOrder;
  payment: MercadoPagoPaymentResponse;
}) {
  const paymentOrderCode = getPaymentOrderCode(payment);

  if (paymentOrderCode !== order.code) {
    throw new HttpError(
      400,
      "PAYMENT_ORDER_MISMATCH",
      "O pagamento recebido nao pertence a este pedido."
    );
  }

  const paymentStatus = mapMercadoPagoPaymentStatus(payment.status);
  const orderStatus = mapMercadoPagoOrderStatus(paymentStatus);
  const amountCents = Math.round((payment.transaction_amount ?? 0) * 100);

  if (amountCents !== order.total_cents) {
    throw new HttpError(
      400,
      "PAYMENT_AMOUNT_MISMATCH",
      "O valor aprovado no Mercado Pago nao confere com o total do pedido."
    );
  }

  const { data: existingPayment, error: existingPaymentError } = await supabase
    .from("payments")
    .select("id")
    .eq("order_id", order.id)
    .limit(1)
    .maybeSingle();

  if (existingPaymentError) {
    throw existingPaymentError;
  }

  const paymentPayload = {
    order_id: order.id,
    provider: "mercado_pago",
    mercado_pago_payment_id: String(payment.id),
    external_reference: order.code,
    status: paymentStatus,
    status_detail: payment.status_detail ?? null,
    amount_cents: amountCents,
    currency: payment.currency_id ?? "BRL",
    paid_at: payment.date_approved ?? null,
    raw_payload: payment
  };

  let paymentRow: PaymentRow | null = null;

  if (existingPayment) {
    const { data: updatedPayment, error: paymentUpdateError } = await supabase
      .from("payments")
      .update(paymentPayload)
      .eq("id", existingPayment.id)
      .select("id")
      .single();

    if (paymentUpdateError) {
      throw paymentUpdateError;
    }

    paymentRow = updatedPayment as PaymentRow;
  } else {
    const { data: createdPayment, error: paymentCreateError } = await supabase
      .from("payments")
      .insert(paymentPayload)
      .select("id")
      .single();

    if (paymentCreateError) {
      throw paymentCreateError;
    }

    paymentRow = createdPayment as PaymentRow;
  }

  const { data: updatedOrder, error: orderUpdateError } = await supabase
    .from("orders")
    .update({
      status: orderStatus,
      payment_status: paymentStatus
    })
    .eq("id", order.id)
    .select("id, code, status, payment_status, total_cents")
    .single();

  if (orderUpdateError) {
    throw orderUpdateError;
  }

  const customRequestId = await findCustomRequestIdForOrder(supabase, order.id);

  if (paymentStatus === "approved" && customRequestId) {
    const { error: requestUpdateError } = await supabase
      .from("custom_requests")
      .update({ status: "converted" })
      .eq("id", customRequestId);

    if (requestUpdateError) {
      throw requestUpdateError;
    }
  }

  let melhorEnvioShipment = null;

  if (paymentStatus === "approved") {
    try {
      melhorEnvioShipment = await ensureMelhorEnvioShipmentForPaidOrder({
        supabase,
        orderId: order.id
      });
    } catch (error) {
      console.error("[melhor-envio] post-payment shipment sync failed", {
        orderId: order.id,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  return {
    order: updatedOrder,
    payment: paymentRow,
    paymentStatus,
    orderStatus,
    amountCents,
    melhorEnvioShipment
  };
}

export async function syncMercadoPagoPaymentForOrder({
  supabase,
  order,
  paymentId
}: {
  supabase: SupabaseAdminClient;
  order: SyncableOrder;
  paymentId: string;
}) {
  const payment = await getMercadoPagoPayment(paymentId);

  return applyMercadoPagoPaymentToOrder({
    supabase,
    order,
    payment
  });
}
