import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { formatBrazilianPhone } from "@lm-3d/shared";
import { HttpError } from "../lib/http.js";
import { ensureMercadoPagoPreferenceForOrder } from "../lib/order-payments.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";
import { createOrderCode, getBearerToken } from "./orders.js";

const customRequestSchema = z.object({
  customer_name: z.string().trim().min(2).max(120),
  customer_contact: z.string().trim().min(3).max(180),
  customer_email: z.string().trim().email().max(180).optional().nullable(),
  customer_phone: z.string().trim().max(40).optional().nullable(),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(2000),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  desired_material: z.string().trim().max(80).optional().nullable(),
  desired_colors: z.string().trim().max(160).optional().nullable(),
  deadline: z.string().trim().max(120).optional().nullable(),
  reference_url: z.string().trim().url().max(500).optional().nullable()
});

export const customRequestsRouter = Router();

function createRequestCode() {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  return `ORC-${suffix}`;
}

customRequestsRouter.post("/", async (req, res, next) => {
  try {
    const payload = customRequestSchema.parse(req.body);
    const customerPhone = payload.customer_phone ? formatBrazilianPhone(payload.customer_phone) : null;
    const supabase = getSupabaseAdminClient();
    const token = getBearerToken(req.header("authorization"));

    if (!token) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Entre ou crie uma conta para enviar um orçamento.");
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Sua sessão expirou. Entre novamente.");
    }

    const customerEmail = payload.customer_email ?? user.email ?? null;
    const customerContact = customerEmail ? payload.customer_contact : customerPhone ?? payload.customer_contact;

    const { data, error } = await supabase
      .from("custom_requests")
      .insert({
        ...payload,
        customer_contact: customerContact,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        code: createRequestCode(),
        user_id: user.id,
        status: "new"
      })
      .select("id, code, status")
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ request: data });
  } catch (error) {
    next(error);
  }
});

customRequestsRouter.post("/:code/checkout", async (req, res, next) => {
  try {
    const { code } = z.object({ code: z.string().trim().min(1).max(40) }).parse(req.params);
    const supabase = getSupabaseAdminClient();
    const token = getBearerToken(req.header("authorization"));

    if (!token) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Entre para pagar o orçamento.");
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Sua sessão expirou. Entre novamente.");
    }

    const { data: request, error: requestError } = await supabase
      .from("custom_requests")
      .select("*")
      .eq("code", code)
      .eq("user_id", user.id)
      .maybeSingle();

    if (requestError) {
      throw requestError;
    }

    if (!request) {
      throw new HttpError(404, "CUSTOM_REQUEST_NOT_FOUND", "Orçamento não encontrado.");
    }

    if (request.status !== "quoted" || !request.estimated_price_cents) {
      throw new HttpError(
        400,
        "CUSTOM_REQUEST_NOT_PAYABLE",
        "Este orçamento ainda não está liberado para pagamento."
      );
    }

    const customerEmail = request.customer_email ?? user.email;

    if (!customerEmail) {
      throw new HttpError(
        400,
        "CUSTOM_REQUEST_WITHOUT_EMAIL",
        "Este orçamento precisa de um e-mail para gerar o pagamento."
      );
    }

    const { data: existingOrder, error: existingOrderError } = await supabase
      .from("order_items")
      .select("order:orders(*)")
      .contains("product_snapshot", { custom_request_id: request.id })
      .maybeSingle();

    if (existingOrderError) {
      throw existingOrderError;
    }

    let order = Array.isArray(existingOrder?.order) ? existingOrder.order[0] : existingOrder?.order;

    if (!order) {
      const { data: createdOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          code: createOrderCode(),
          user_id: user.id,
          customer_name: request.customer_name,
          customer_email: customerEmail,
          customer_phone: request.customer_phone,
          status: "pending_payment",
          payment_status: "pending",
          subtotal_cents: request.estimated_price_cents,
          shipping_cents: 0,
          discount_cents: 0,
          total_cents: request.estimated_price_cents,
          delivery_method: "Entrega a combinar",
          customer_notes: `Orçamento ${request.code}: ${request.description}`,
          admin_notes: request.admin_notes
        })
        .select("*")
        .single();

      if (orderError) {
        throw orderError;
      }

      const { error: itemError } = await supabase.from("order_items").insert({
        order_id: createdOrder.id,
        product_id: null,
        product_snapshot: {
          type: "custom_request",
          custom_request_id: request.id,
          custom_request_code: request.code,
          name: request.title,
          description: request.description,
          quantity_requested: request.quantity,
          desired_material: request.desired_material,
          desired_colors: request.desired_colors,
          quoted_deadline: request.quoted_deadline ?? null,
          reference_url: request.reference_url
        },
        quantity: 1,
        unit_price_cents: request.estimated_price_cents,
        line_total_cents: request.estimated_price_cents,
        customization_notes:
          request.quoted_deadline || request.deadline
            ? [
                request.quoted_deadline ? `Prazo informado: ${request.quoted_deadline}` : null,
                request.deadline ? `Prazo desejado: ${request.deadline}` : null
              ]
                .filter(Boolean)
                .join("\n")
            : null
      });

      if (itemError) {
        await supabase.from("orders").delete().eq("id", createdOrder.id);
        throw itemError;
      }

      order = createdOrder;
    }

    if (order.payment_status === "approved") {
      throw new HttpError(400, "CUSTOM_REQUEST_ALREADY_PAID", "Este orçamento já foi pago.");
    }

    const preference = await ensureMercadoPagoPreferenceForOrder({
      supabase,
      order: {
        id: order.id,
        code: order.code,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        total_cents: order.total_cents
      },
      items: [
        {
          title: `Orçamento ${request.code} - ${request.title}`,
          quantity: 1,
          unitPriceCents: order.total_cents
        }
      ]
    });

    res.status(201).json({
      request: {
        id: request.id,
        code: request.code,
        status: request.status,
        estimatedPriceCents: request.estimated_price_cents
      },
      order: {
        id: order.id,
        code: order.code,
        status: order.status,
        paymentStatus: order.payment_status,
        totalCents: order.total_cents
      },
      payment: {
        provider: "mercado_pago",
        preferenceId: preference.id,
        checkoutUrl: preference.checkoutUrl,
        sandboxCheckoutUrl: preference.sandboxCheckoutUrl
      }
    });
  } catch (error) {
    next(error);
  }
});
