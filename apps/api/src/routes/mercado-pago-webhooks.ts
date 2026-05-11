import { Router } from "express";
import { HttpError } from "../lib/http.js";
import {
  getMercadoPagoPayment,
  mapMercadoPagoOrderStatus,
  mapMercadoPagoPaymentStatus,
  verifyMercadoPagoWebhookSignature
} from "../lib/mercado-pago.js";
import { findCustomRequestIdForOrder } from "../lib/order-payments.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";

type MercadoPagoWebhookBody = {
  id?: string | number;
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

type OrderRow = {
  id: string;
  code: string;
};

type PaymentRow = {
  id: string;
};

export const mercadoPagoWebhooksRouter = Router();

function getResourceId(body: MercadoPagoWebhookBody, queryId: unknown) {
  if (typeof queryId === "string" && queryId.trim()) {
    return queryId.trim();
  }

  if (typeof body.data?.id === "number" || typeof body.data?.id === "string") {
    return String(body.data.id);
  }

  return null;
}

function getEventId(body: MercadoPagoWebhookBody, requestId: string | null, resourceId: string | null) {
  if (typeof body.id === "string" || typeof body.id === "number") {
    return String(body.id);
  }

  return [requestId ?? "request", body.action ?? body.type ?? "event", resourceId ?? "resource"].join(
    ":"
  );
}

mercadoPagoWebhooksRouter.post("/mercado-pago", async (req, res, next) => {
  const supabase = getSupabaseAdminClient();
  const body = req.body as MercadoPagoWebhookBody;
  const resourceId = getResourceId(body, req.query["data.id"]);
  const requestId = req.header("x-request-id") ?? null;
  const signature = req.header("x-signature") ?? null;
  const signatureValid = verifyMercadoPagoWebhookSignature({
    dataId: resourceId,
    requestId,
    signature
  });
  const eventId = getEventId(body, requestId, resourceId);
  let eventRowId: string | null = null;

  try {
    const { data: insertedEvent, error: insertEventError } = await supabase
      .from("payment_events")
      .insert({
        provider: "mercado_pago",
        event_id: eventId,
        event_type: body.type ?? null,
        action: body.action ?? null,
        resource_id: resourceId,
        headers: {
          "x-request-id": requestId,
          "x-signature": signature ? "[received]" : null
        },
        payload: body,
        signature_valid: signatureValid
      })
      .select("id")
      .single();

    if (insertEventError) {
      if (insertEventError.code === "23505") {
        res.status(200).json({ ok: true, duplicate: true });
        return;
      }

      throw insertEventError;
    }

    eventRowId = insertedEvent.id as string;

    if (!signatureValid) {
      throw new HttpError(401, "INVALID_MERCADO_PAGO_SIGNATURE", "Assinatura invalida.");
    }

    if (!resourceId) {
      throw new HttpError(400, "MERCADO_PAGO_EVENT_WITHOUT_PAYMENT", "Evento sem pagamento.");
    }

    const payment = await getMercadoPagoPayment(resourceId);
    const orderCode =
      payment.external_reference ??
      (typeof payment.metadata?.order_code === "string" ? payment.metadata.order_code : null);

    if (!orderCode) {
      throw new HttpError(
        400,
        "MERCADO_PAGO_EVENT_WITHOUT_REFERENCE",
        "Evento sem referencia de pedido."
      );
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id, code")
      .eq("code", orderCode)
      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    const order = orderData as OrderRow | null;

    if (!order) {
      throw new HttpError(404, "ORDER_NOT_FOUND", "Pedido do pagamento nao encontrado.");
    }

    const paymentStatus = mapMercadoPagoPaymentStatus(payment.status);
    const orderStatus = mapMercadoPagoOrderStatus(paymentStatus);
    const amountCents = Math.round((payment.transaction_amount ?? 0) * 100);
    const paidAt = payment.date_approved ?? null;

    const { data: existingPayment, error: existingPaymentError } = await supabase
      .from("payments")
      .select("id")
      .eq("order_id", order.id)
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
      paid_at: paidAt,
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

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        status: orderStatus,
        payment_status: paymentStatus
      })
      .eq("id", order.id);

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

    await supabase
      .from("payment_events")
      .update({
        order_id: order.id,
        payment_id: paymentRow.id,
        processed_at: new Date().toISOString(),
        processing_error: null
      })
      .eq("id", eventRowId);

    res.status(200).json({ ok: true });
  } catch (error) {
    if (eventRowId) {
      await supabase
        .from("payment_events")
        .update({
          processed_at: new Date().toISOString(),
          processing_error: error instanceof Error ? error.message : "Erro desconhecido"
        })
        .eq("id", eventRowId);
    }

    next(error);
  }
});
