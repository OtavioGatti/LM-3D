import { formatBrazilianPhone, isPublicProductStatus, type ProductStatus } from "@lm-3d/shared";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import {
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  mapMercadoPagoOrderStatus,
  mapMercadoPagoPaymentStatus
} from "../lib/mercado-pago.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  price_cents: number;
  status: string;
  material: string | null;
  dimensions: string | null;
  accepts_customization: boolean;
};

type CouponRow = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_cents: number;
  max_redemptions: number | null;
  redeemed_count: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

const checkoutOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(180),
    phone: z.string().trim().max(40).optional().nullable()
  }),
  delivery: z.object({
    method: z.enum(["retirada", "entrega_combinar"]).default("entrega_combinar"),
    address: z
      .object({
        line1: z.string().trim().max(180).optional().nullable(),
        city: z.string().trim().max(100).optional().nullable(),
        state: z.string().trim().max(60).optional().nullable(),
        postalCode: z.string().trim().max(30).optional().nullable()
      })
      .optional()
      .nullable()
  }),
  notes: z.string().trim().max(1200).optional().nullable(),
  couponCode: z.string().trim().max(40).optional().nullable(),
  items: z
    .array(
      z.object({
        productSlug: z.string().trim().min(1).max(120),
        quantity: z.coerce.number().int().min(1).max(99),
        notes: z.string().trim().max(800).optional().nullable()
      })
    )
    .min(1)
    .max(40)
});

const paymentSyncSchema = z.object({
  paymentId: z.string().trim().min(1).max(80)
});

export const ordersRouter = Router();

function getBearerToken(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

function createOrderCode() {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  return `LM3D-${stamp}-${suffix}`;
}

function calculateCouponDiscount(coupon: CouponRow, subtotalCents: number) {
  if (!coupon.is_active) {
    throw new HttpError(400, "COUPON_INACTIVE", "Cupom inativo.");
  }

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    throw new HttpError(400, "COUPON_NOT_STARTED", "Cupom ainda nao esta ativo.");
  }

  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) {
    throw new HttpError(400, "COUPON_EXPIRED", "Cupom expirado.");
  }

  if (coupon.max_redemptions !== null && coupon.redeemed_count >= coupon.max_redemptions) {
    throw new HttpError(400, "COUPON_LIMIT_REACHED", "Este cupom atingiu o limite de uso.");
  }

  if (subtotalCents < coupon.min_order_cents) {
    throw new HttpError(400, "COUPON_MIN_ORDER", "O pedido nao atinge o valor minimo do cupom.");
  }

  const discount =
    coupon.discount_type === "percent"
      ? Math.floor((subtotalCents * coupon.discount_value) / 100)
      : coupon.discount_value;

  return Math.max(0, Math.min(discount, subtotalCents));
}

ordersRouter.post("/", async (req, res, next) => {
  try {
    const payload = checkoutOrderSchema.parse(req.body);
    const customerPhone = payload.customer.phone ? formatBrazilianPhone(payload.customer.phone) : null;
    const supabase = getSupabaseAdminClient();
    const token = getBearerToken(req.header("authorization"));

    if (!token) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Entre ou crie uma conta para finalizar o pedido.");
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Sua sessão expirou. Entre novamente para finalizar o pedido.");
    }

    const requestedSlugs = [...new Set(payload.items.map((item) => item.productSlug))];

    const { data: products, error: productError } = await supabase
      .from("products")
      .select(
        "id, slug, name, short_description, price_cents, status, material, dimensions, accepts_customization"
      )
      .in("slug", requestedSlugs);

    if (productError) {
      throw productError;
    }

    const productBySlug = new Map(
      ((products ?? []) as ProductRow[])
        .filter((product) => isPublicProductStatus(product.status as ProductStatus))
        .map((product) => [product.slug, product])
    );

    const orderItems = payload.items.map((item) => {
      const product = productBySlug.get(item.productSlug);

      if (!product) {
        throw new HttpError(
          400,
          "PRODUCT_UNAVAILABLE",
          "Um dos produtos do carrinho nao esta disponivel para compra."
        );
      }

      const lineTotalCents = product.price_cents * item.quantity;

      return {
        product_id: product.id,
        product_snapshot: {
          slug: product.slug,
          name: product.name,
          short_description: product.short_description,
          material: product.material,
          dimensions: product.dimensions,
          accepts_customization: product.accepts_customization
        },
        quantity: item.quantity,
        unit_price_cents: product.price_cents,
        line_total_cents: lineTotalCents,
        customization_notes: item.notes || null
      };
    });

    const subtotalCents = orderItems.reduce((total, item) => total + item.line_total_cents, 0);
    const couponCode = payload.couponCode?.trim().toUpperCase() || null;
    let coupon: CouponRow | null = null;
    let discountCents = 0;

    if (couponCode) {
      const { data: couponData, error: couponError } = await supabase
        .from("discount_coupons")
        .select("*")
        .eq("code", couponCode)
        .maybeSingle();

      if (couponError) {
        throw couponError;
      }

      if (!couponData) {
        throw new HttpError(400, "COUPON_NOT_FOUND", "Cupom nao encontrado.");
      }

      coupon = couponData as CouponRow;
      discountCents = calculateCouponDiscount(coupon, subtotalCents);
    }

    const code = createOrderCode();
    const totalCents = subtotalCents - discountCents;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        code,
        user_id: user.id,
        customer_name: payload.customer.name,
        customer_email: payload.customer.email,
        customer_phone: customerPhone,
        status: "pending_payment",
        payment_status: "pending",
        subtotal_cents: subtotalCents,
        shipping_cents: 0,
        discount_cents: discountCents,
        total_cents: totalCents,
        delivery_method:
          payload.delivery.method === "retirada" ? "Retirada com Lucas" : "Entrega a combinar",
        delivery_address: payload.delivery.address ?? null,
        customer_notes: payload.notes || null
      })
      .select("*")
      .single();

    if (orderError) {
      throw orderError;
    }

    if (coupon) {
      const couponUpdate = supabase
        .from("discount_coupons")
        .update({ redeemed_count: coupon.redeemed_count + 1 })
        .eq("id", coupon.id);
      const { data: updatedCoupon, error: couponLimitError } =
        coupon.max_redemptions === null
          ? await couponUpdate.select("id").single()
          : await couponUpdate
              .lt("redeemed_count", coupon.max_redemptions)
              .select("id")
              .maybeSingle();

      if (couponLimitError || !updatedCoupon) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw new HttpError(400, "COUPON_LIMIT_REACHED", "Este cupom atingiu o limite de uso.");
      }

      const { error: redemptionError } = await supabase.from("discount_coupon_redemptions").insert({
        coupon_id: coupon.id,
        order_id: order.id,
        user_id: user.id,
        customer_email: payload.customer.email,
        discount_cents: discountCents
      });

      if (redemptionError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw redemptionError;
      }
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      orderItems.map((item) => ({
        ...item,
        order_id: order.id
      }))
    );

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    let preference: Awaited<ReturnType<typeof createMercadoPagoPreference>>;

    try {
      preference = await createMercadoPagoPreference({
        orderId: order.id,
        orderCode: order.code,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone,
        totalCents: order.total_cents,
        items: [
          {
            title: `Pedido ${order.code} - LM-3D`,
            quantity: 1,
            unitPriceCents: order.total_cents
          }
        ]
      });
    } catch (error) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw error;
    }

    const { error: paymentError } = await supabase.from("payments").insert({
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
    });

    if (paymentError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw paymentError;
    }

    res.status(201).json({
      order: {
        id: order.id,
        code: order.code,
        status: order.status,
        paymentStatus: order.payment_status,
        totalCents: order.total_cents,
        discountCents: order.discount_cents
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

ordersRouter.post("/:code/payment-sync", async (req, res, next) => {
  try {
    const { code } = z.object({ code: z.string().trim().min(1).max(80) }).parse(req.params);
    const { paymentId } = paymentSyncSchema.parse(req.body);
    const supabase = getSupabaseAdminClient();
    const token = getBearerToken(req.header("authorization"));

    if (!token) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Entre para atualizar o pagamento do pedido.");
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Sua sessao expirou. Entre novamente.");
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, code, user_id, total_cents")
      .eq("code", code)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    if (!order) {
      throw new HttpError(404, "ORDER_NOT_FOUND", "Pedido nao encontrado para esta conta.");
    }

    const payment = await getMercadoPagoPayment(paymentId);

    if (payment.external_reference !== order.code) {
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
      .maybeSingle();

    if (existingPaymentError) {
      throw existingPaymentError;
    }

    const paymentPayload = {
      mercado_pago_payment_id: String(payment.id),
      status: paymentStatus,
      status_detail: payment.status_detail ?? null,
      amount_cents: amountCents,
      currency: payment.currency_id ?? "BRL",
      paid_at: payment.date_approved ?? null,
      raw_payload: payment
    };

    if (existingPayment) {
      const { error: paymentUpdateError } = await supabase
        .from("payments")
        .update(paymentPayload)
        .eq("id", existingPayment.id);

      if (paymentUpdateError) {
        throw paymentUpdateError;
      }
    } else {
      const { error: paymentCreateError } = await supabase.from("payments").insert({
        ...paymentPayload,
        order_id: order.id,
        provider: "mercado_pago",
        external_reference: order.code
      });

      if (paymentCreateError) {
        throw paymentCreateError;
      }
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

    res.json({
      order: {
        id: updatedOrder.id,
        code: updatedOrder.code,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.payment_status,
        totalCents: updatedOrder.total_cents
      }
    });
  } catch (error) {
    next(error);
  }
});
