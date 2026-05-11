import type { PaymentStatus } from "@lm-3d/shared";
import { createMercadoPagoPreference, type MercadoPagoPreferenceItem } from "./mercado-pago.js";
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
