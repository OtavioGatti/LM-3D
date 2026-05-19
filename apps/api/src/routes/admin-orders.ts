import { ORDER_STATUSES, PAYMENT_STATUSES } from "@lm-3d/shared";
import { Router } from "express";
import { z } from "zod";
import {
  notifyOrderPaymentApproved,
  notifyOrderTrackingAvailable
} from "../lib/email-notifications.js";
import { searchMercadoPagoPaymentsByExternalReference } from "../lib/mercado-pago.js";
import { syncMercadoPagoPaymentForOrder } from "../lib/order-payments.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";

const orderUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  payment_status: z.enum(PAYMENT_STATUSES).optional(),
  admin_notes: z.string().trim().optional().nullable(),
  tracking_code: z.string().trim().optional().nullable(),
  delivery_method: z.string().trim().optional().nullable()
});

export const adminOrdersRouter = Router();

const orderSelect = `
  *,
  order_items (*),
  payments (*),
  discount_coupon_redemptions (
    *,
    discount_coupons (
      code,
      name
    )
  )
`;

type OrderPaymentCheckRow = {
  id: string;
  code: string;
  total_cents: number;
};

type StoredPaymentRow = {
  mercado_pago_payment_id: string | null;
};

function pickMostUsefulPayment(payments: Awaited<ReturnType<typeof searchMercadoPagoPaymentsByExternalReference>>) {
  return (
    payments.find((payment) => payment.status === "approved") ??
    payments.find((payment) => payment.status === "pending" || payment.status === "in_process") ??
    payments[0] ??
    null
  );
}

function getShipmentMessage(
  shipment: Awaited<ReturnType<typeof syncMercadoPagoPaymentForOrder>>["melhorEnvioShipment"]
) {
  if (!shipment || shipment.status === "skipped") {
    return "";
  }

  if (shipment.status === "purchased") {
    return " Etiqueta comprada no Melhor Envio.";
  }

  if (shipment.status === "cart_created") {
    return " Etiqueta inserida no carrinho do Melhor Envio.";
  }

  if (shipment.status === "in_progress") {
    return " A etiqueta já está sendo sincronizada.";
  }

  return ` Melhor Envio: ${shipment.message}`;
}

async function getOrderWithRelations(orderId: string) {
  return getSupabaseAdminClient()
    .from("orders")
    .select(orderSelect)
    .eq("id", orderId)
    .single();
}

adminOrdersRouter.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await getSupabaseAdminClient()
      .from("orders")
      .select(orderSelect)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({ orders: data });
  } catch (error) {
    next(error);
  }
});

adminOrdersRouter.patch("/:id", async (req, res, next) => {
  try {
    const payload = orderUpdateSchema.parse(req.body);
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", req.params.id)
      .select(orderSelect)
      .single();

    if (error) {
      throw error;
    }

    if (data.payment_status === "approved") {
      await notifyOrderPaymentApproved({
        supabase,
        orderId: data.id
      });
    }

    if (data.tracking_code) {
      await notifyOrderTrackingAvailable({
        supabase,
        orderId: data.id
      });
    }

    res.json({ order: data });
  } catch (error) {
    next(error);
  }
});

adminOrdersRouter.post("/:id/verify-payment", async (req, res, next) => {
  try {
    const supabase = getSupabaseAdminClient();

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("id, code, total_cents")
      .eq("id", req.params.id)
      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    const order = orderData as OrderPaymentCheckRow | null;

    if (!order) {
      res.status(404).json({ message: "Pedido não encontrado." });
      return;
    }

    const { data: storedPayments, error: storedPaymentsError } = await supabase
      .from("payments")
      .select("mercado_pago_payment_id")
      .eq("order_id", order.id)
      .not("mercado_pago_payment_id", "is", null)
      .limit(1);

    if (storedPaymentsError) {
      throw storedPaymentsError;
    }

    const storedPayment = (storedPayments?.[0] ?? null) as StoredPaymentRow | null;
    let paymentId = storedPayment?.mercado_pago_payment_id ?? null;

    if (!paymentId) {
      const mercadoPagoPayments = await searchMercadoPagoPaymentsByExternalReference(order.code);
      const mercadoPagoPayment = pickMostUsefulPayment(mercadoPagoPayments);

      if (!mercadoPagoPayment) {
        const { data: unchangedOrder, error: unchangedOrderError } = await getOrderWithRelations(order.id);

        if (unchangedOrderError) {
          throw unchangedOrderError;
        }

        res.json({
          order: unchangedOrder,
          message: "Nenhum pagamento foi encontrado no Mercado Pago para este pedido."
        });
        return;
      }

      paymentId = String(mercadoPagoPayment.id);
    }

    const { paymentStatus, melhorEnvioShipment } = await syncMercadoPagoPaymentForOrder({
      supabase,
      order,
      paymentId
    });

    const { data: updatedOrder, error: updatedOrderError } = await getOrderWithRelations(order.id);

    if (updatedOrderError) {
      throw updatedOrderError;
    }

    res.json({
      order: updatedOrder,
      message:
        paymentStatus === "approved"
          ? `Pagamento aprovado no Mercado Pago e pedido atualizado.${getShipmentMessage(
              melhorEnvioShipment
            )}`
          : "Pagamento consultado no Mercado Pago. O pedido foi atualizado com o status atual."
    });
  } catch (error) {
    next(error);
  }
});
