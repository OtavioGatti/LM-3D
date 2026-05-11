import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentStatus } from "@lm-3d/shared";
import { env } from "../config/env.js";
import { HttpError } from "./http.js";

const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";

type PreferenceItem = {
  title: string;
  quantity: number;
  unitPriceCents: number;
};

type CreatePreferenceInput = {
  orderId: string;
  orderCode: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  totalCents: number;
  items: PreferenceItem[];
};

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export type MercadoPagoPaymentResponse = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string;
  metadata?: Record<string, unknown>;
};

export function hasMercadoPagoConfig() {
  return Boolean(env.MERCADO_PAGO_ACCESS_TOKEN);
}

export function mapMercadoPagoPaymentStatus(status: string): PaymentStatus {
  if (status === "approved") {
    return "approved";
  }

  if (status === "rejected") {
    return "rejected";
  }

  if (status === "cancelled" || status === "canceled") {
    return "cancelled";
  }

  if (status === "refunded") {
    return "refunded";
  }

  if (status === "charged_back") {
    return "charged_back";
  }

  return "pending";
}

export function mapMercadoPagoOrderStatus(paymentStatus: PaymentStatus) {
  if (paymentStatus === "approved") {
    return "paid";
  }

  if (paymentStatus === "rejected") {
    return "payment_failed";
  }

  if (paymentStatus === "cancelled") {
    return "canceled";
  }

  if (paymentStatus === "refunded" || paymentStatus === "charged_back") {
    return "refunded";
  }

  return "pending_payment";
}

function centsToAmount(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function getCustomerFirstAndLastName(name: string) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() ?? name;
  const lastName = parts.join(" ");

  return { firstName, lastName };
}

function isPublicHttpsUrl(url: URL) {
  return (
    url.protocol === "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1" &&
    !url.hostname.endsWith(".local")
  );
}

export async function createMercadoPagoPreference(input: CreatePreferenceInput) {
  if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
    throw new HttpError(
      503,
      "MERCADO_PAGO_NOT_CONFIGURED",
      "Mercado Pago ainda nao foi configurado no backend."
    );
  }

  const { firstName, lastName } = getCustomerFirstAndLastName(input.customerName);
  const successUrl = new URL("/pedido-confirmado", env.APP_PUBLIC_URL);
  successUrl.searchParams.set("code", input.orderCode);
  successUrl.searchParams.set("payment", "pending");

  const pendingUrl = new URL("/pedido-confirmado", env.APP_PUBLIC_URL);
  pendingUrl.searchParams.set("code", input.orderCode);
  pendingUrl.searchParams.set("payment", "pending");

  const failureUrl = new URL("/checkout", env.APP_PUBLIC_URL);
  failureUrl.searchParams.set("payment", "failed");
  failureUrl.searchParams.set("code", input.orderCode);

  const notificationUrl = new URL("/api/webhooks/mercado-pago", env.API_PUBLIC_URL);
  const canUseAutoReturn = isPublicHttpsUrl(successUrl);

  if (env.NODE_ENV === "production" && !canUseAutoReturn) {
    throw new HttpError(
      503,
      "APP_PUBLIC_URL_INVALID_FOR_MERCADO_PAGO",
      "Configure APP_PUBLIC_URL no backend com a URL publica HTTPS da Vercel antes de criar pagamentos."
    );
  }

  const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      items: input.items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        unit_price: centsToAmount(item.unitPriceCents),
        currency_id: "BRL"
      })),
      payer: {
        name: firstName,
        surname: lastName || undefined,
        email: input.customerEmail,
        phone: input.customerPhone
          ? {
              number: input.customerPhone
            }
          : undefined
      },
      external_reference: input.orderCode,
      notification_url: notificationUrl.toString(),
      back_urls: {
        success: successUrl.toString(),
        pending: pendingUrl.toString(),
        failure: failureUrl.toString()
      },
      ...(canUseAutoReturn ? { auto_return: "approved" } : {}),
      metadata: {
        order_id: input.orderId,
        order_code: input.orderCode
      },
      statement_descriptor: "LM-3D"
    })
  });

  const data = (await response.json().catch(() => null)) as
    | (MercadoPagoPreferenceResponse & { message?: string; error?: string })
    | null;

  if (!response.ok || !data?.id) {
    throw new HttpError(
      502,
      "MERCADO_PAGO_PREFERENCE_FAILED",
      data?.message ?? "Nao foi possivel criar o pagamento no Mercado Pago."
    );
  }

  return {
    id: data.id,
    checkoutUrl: data.init_point ?? data.sandbox_init_point ?? null,
    sandboxCheckoutUrl: data.sandbox_init_point ?? null,
    rawPayload: data
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  if (!env.MERCADO_PAGO_ACCESS_TOKEN) {
    throw new HttpError(
      503,
      "MERCADO_PAGO_NOT_CONFIGURED",
      "Mercado Pago ainda nao foi configurado no backend."
    );
  }

  const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${env.MERCADO_PAGO_ACCESS_TOKEN}`
    }
  });

  const data = (await response.json().catch(() => null)) as
    | (MercadoPagoPaymentResponse & { message?: string })
    | null;

  if (!response.ok || !data?.id) {
    throw new HttpError(
      502,
      "MERCADO_PAGO_PAYMENT_FETCH_FAILED",
      data?.message ?? "Nao foi possivel consultar o pagamento no Mercado Pago."
    );
  }

  return data;
}

export function verifyMercadoPagoWebhookSignature(input: {
  dataId: string | null;
  requestId: string | null;
  signature: string | null;
}) {
  if (!env.MERCADO_PAGO_WEBHOOK_SECRET) {
    return env.NODE_ENV !== "production";
  }

  const ts = input.signature
    ?.split(",")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === "ts")?.[1];
  const v1 = input.signature
    ?.split(",")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === "v1")?.[1];

  if (!input.dataId || !input.requestId || !ts || !v1) {
    return false;
  }

  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${ts};`;
  const digest = createHmac("sha256", env.MERCADO_PAGO_WEBHOOK_SECRET)
    .update(manifest)
    .digest("hex");

  const received = Buffer.from(v1, "hex");
  const expected = Buffer.from(digest, "hex");

  return received.length === expected.length && timingSafeEqual(received, expected);
}
