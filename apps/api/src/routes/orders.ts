import {
  formatBrazilianPhone,
  isPublicProductStatus,
  PICKUP_SHIPPING_OPTION,
  type ProductStatus
} from "@lm-3d/shared";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  type CheckoutProductRow,
  loadCheckoutProductsBySlug
} from "../lib/checkout-products.js";
import { HttpError } from "../lib/http.js";
import {
  getStoreOriginPostalCode,
  normalizePostalCode,
  quoteMelhorEnvioShipping,
  toPublicShippingOption
} from "../lib/melhor-envio.js";
import {
  ensureMercadoPagoPreferenceForOrder,
  syncMercadoPagoPaymentForOrder
} from "../lib/order-payments.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";

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
    phone: z.string().trim().max(40).optional().nullable(),
    document: z.string().trim().max(30).optional().nullable()
  }),
  delivery: z.object({
    method: z.enum(["retirada", "melhor_envio", "entrega_combinar"]).default("melhor_envio"),
    address: z
      .object({
        line1: z.string().trim().max(180).optional().nullable(),
        number: z.string().trim().max(30).optional().nullable(),
        district: z.string().trim().max(100).optional().nullable(),
        complement: z.string().trim().max(100).optional().nullable(),
        city: z.string().trim().max(100).optional().nullable(),
        state: z.string().trim().max(60).optional().nullable(),
        postalCode: z.string().trim().max(30).optional().nullable()
      })
      .optional()
      .nullable()
  }),
  shipping: z
    .object({
      optionId: z.string().trim().min(1).max(120),
      provider: z.enum(["pickup", "melhor_envio"]),
      serviceId: z.string().trim().max(80).optional().nullable()
    })
    .optional()
    .nullable(),
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

export function getBearerToken(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export function createOrderCode() {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  return `LM3D-${stamp}-${suffix}`;
}

type CheckoutOrderPayload = z.infer<typeof checkoutOrderSchema>;

type ShippingSelection = {
  shippingCents: number;
  deliveryMethod: string;
  deliveryAddress: CheckoutOrderPayload["delivery"]["address"] | null | undefined;
  provider: "pickup" | "melhor_envio" | null;
  serviceId: string | null;
  serviceName: string | null;
  companyName: string | null;
  deliveryTimeDays: number | null;
  originPostalCode: string | null;
  destinationPostalCode: string | null;
  quoteSnapshot: Record<string, unknown>;
};

function buildQuoteProducts(
  items: CheckoutOrderPayload["items"],
  productBySlug: Map<string, CheckoutProductRow>
) {
  const quantityBySlug = new Map<string, number>();

  for (const item of items) {
    quantityBySlug.set(item.productSlug, (quantityBySlug.get(item.productSlug) ?? 0) + item.quantity);
  }

  return [...quantityBySlug.entries()].map(([slug, quantity]) => {
    const product = productBySlug.get(slug);

    if (!product) {
      throw new HttpError(
        400,
        "PRODUCT_UNAVAILABLE",
        "Um dos produtos do carrinho não está disponível para compra."
      );
    }

    return {
      ...product,
      quantity
    };
  });
}

async function resolveShippingSelection({
  payload,
  quoteProducts
}: {
  payload: CheckoutOrderPayload;
  quoteProducts: ReturnType<typeof buildQuoteProducts>;
}): Promise<ShippingSelection> {
  if (payload.delivery.method === "retirada") {
    return {
      shippingCents: 0,
      deliveryMethod: PICKUP_SHIPPING_OPTION.label,
      deliveryAddress: null,
      provider: "pickup",
      serviceId: null,
      serviceName: PICKUP_SHIPPING_OPTION.serviceName,
      companyName: PICKUP_SHIPPING_OPTION.companyName,
      deliveryTimeDays: null,
      originPostalCode: null,
      destinationPostalCode: null,
      quoteSnapshot: {
        selected: PICKUP_SHIPPING_OPTION
      }
    };
  }

  if (payload.delivery.method === "entrega_combinar") {
    return {
      shippingCents: 0,
      deliveryMethod: "Entrega a combinar",
      deliveryAddress: payload.delivery.address ?? null,
      provider: null,
      serviceId: null,
      serviceName: null,
      companyName: null,
      deliveryTimeDays: null,
      originPostalCode: null,
      destinationPostalCode: payload.delivery.address?.postalCode
        ? normalizePostalCode(payload.delivery.address.postalCode)
        : null,
      quoteSnapshot: {}
    };
  }

  const postalCode = payload.delivery.address?.postalCode;

  if (!postalCode) {
    throw new HttpError(400, "POSTAL_CODE_REQUIRED", "Informe o CEP para calcular o frete.");
  }

  const address = payload.delivery.address;

  if (
    !address?.line1 ||
    !address.number ||
    !address.district ||
    !address.city ||
    !address.state
  ) {
    throw new HttpError(
      400,
      "SHIPPING_ADDRESS_REQUIRED",
      "Preencha rua, número, bairro, cidade, estado e CEP para envio."
    );
  }

  if (payload.shipping?.provider !== "melhor_envio" || !payload.shipping.serviceId) {
    throw new HttpError(400, "SHIPPING_OPTION_REQUIRED", "Escolha uma opção de frete.");
  }

  const destinationPostalCode = normalizePostalCode(postalCode);
  const originPostalCode = getStoreOriginPostalCode();
  const quote = await quoteMelhorEnvioShipping({
    destinationPostalCode,
    products: quoteProducts
  });
  const selectedOption = quote.options.find(
    (option) =>
      option.serviceId === payload.shipping?.serviceId ||
      option.id === payload.shipping?.optionId
  );

  if (!selectedOption) {
    throw new HttpError(
      400,
      "SHIPPING_OPTION_UNAVAILABLE",
      "A opção de frete escolhida não está mais disponível. Calcule o frete novamente."
    );
  }

  return {
    shippingCents: selectedOption.priceCents,
    deliveryMethod: selectedOption.label,
    deliveryAddress: payload.delivery.address ?? null,
    provider: "melhor_envio",
    serviceId: selectedOption.serviceId,
    serviceName: selectedOption.serviceName,
    companyName: selectedOption.companyName,
    deliveryTimeDays: selectedOption.deliveryTimeDays,
    originPostalCode,
    destinationPostalCode,
    quoteSnapshot: {
      selected: toPublicShippingOption(selectedOption),
      rawQuote: selectedOption.rawQuote,
      packages: selectedOption.packages
    }
  };
}

function isMissingShippingOrderColumn(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  return /customer_document|shipping_(provider|service|company|delivery|origin|destination|quote|melhor_envio|label)/.test(
    String(error.message)
  );
}

function stripExtendedShippingColumns(payload: Record<string, unknown>) {
  const stripped = { ...payload };

  delete stripped.shipping_provider;
  delete stripped.shipping_service_id;
  delete stripped.shipping_service_name;
  delete stripped.shipping_company_name;
  delete stripped.shipping_delivery_time_days;
  delete stripped.shipping_origin_postal_code;
  delete stripped.shipping_destination_postal_code;
  delete stripped.shipping_quote;
  delete stripped.customer_document;
  delete stripped.shipping_melhor_envio_order_id;
  delete stripped.shipping_melhor_envio_protocol;
  delete stripped.shipping_melhor_envio_purchase_id;
  delete stripped.shipping_melhor_envio_purchase_protocol;
  delete stripped.shipping_melhor_envio_purchase_status;
  delete stripped.shipping_label_status;
  delete stripped.shipping_label_created_at;
  delete stripped.shipping_label_purchased_at;
  delete stripped.shipping_label_error;
  delete stripped.shipping_label_payload;

  return stripped;
}

async function insertOrderWithShippingDetails(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  payload: Record<string, unknown>
) {
  const { data, error } = await supabase.from("orders").insert(payload).select("*").single();

  if (!error) {
    return data;
  }

  if (!isMissingShippingOrderColumn(error)) {
    throw error;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("orders")
    .insert(stripExtendedShippingColumns(payload))
    .select("*")
    .single();

  if (fallbackError) {
    throw fallbackError;
  }

  return fallbackData;
}

function calculateCouponDiscount(coupon: CouponRow, subtotalCents: number) {
  if (!coupon.is_active) {
    throw new HttpError(400, "COUPON_INACTIVE", "Cupom inativo.");
  }

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    throw new HttpError(400, "COUPON_NOT_STARTED", "Cupom ainda não está ativo.");
  }

  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) {
    throw new HttpError(400, "COUPON_EXPIRED", "Cupom expirado.");
  }

  if (coupon.max_redemptions !== null && coupon.redeemed_count >= coupon.max_redemptions) {
    throw new HttpError(400, "COUPON_LIMIT_REACHED", "Este cupom atingiu o limite de uso.");
  }

  if (subtotalCents < coupon.min_order_cents) {
    throw new HttpError(400, "COUPON_MIN_ORDER", "O pedido não atinge o valor mínimo do cupom.");
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
    const customerDocument = payload.customer.document?.replace(/\D/g, "") || null;
    const supabase = getSupabaseAdminClient();
    const token = getBearerToken(req.header("authorization"));

    if (!token) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Entre ou crie uma conta para finalizar o pedido.");
    }

    if (payload.delivery.method === "melhor_envio" && !customerPhone) {
      throw new HttpError(400, "CUSTOMER_PHONE_REQUIRED", "Informe o telefone para gerar a etiqueta.");
    }

    if (payload.delivery.method === "melhor_envio" && !customerDocument) {
      throw new HttpError(400, "CUSTOMER_DOCUMENT_REQUIRED", "Informe CPF ou CNPJ para gerar a etiqueta.");
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Sua sessão expirou. Entre novamente para finalizar o pedido.");
    }

    const requestedSlugs = [...new Set(payload.items.map((item) => item.productSlug))];

    const products = await loadCheckoutProductsBySlug(supabase, requestedSlugs);
    const productBySlug = new Map(
      products
        .filter((product) => isPublicProductStatus(product.status as ProductStatus))
        .map((product) => [product.slug, product])
    );

    const orderItems = payload.items.map((item) => {
      const product = productBySlug.get(item.productSlug);

      if (!product) {
        throw new HttpError(
          400,
          "PRODUCT_UNAVAILABLE",
          "Um dos produtos do carrinho não está disponível para compra."
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
    const quoteProducts = buildQuoteProducts(payload.items, productBySlug);
    const shippingSelection = await resolveShippingSelection({
      payload,
      quoteProducts
    });
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
        throw new HttpError(400, "COUPON_NOT_FOUND", "Cupom não encontrado.");
      }

      coupon = couponData as CouponRow;
      discountCents = calculateCouponDiscount(coupon, subtotalCents);
    }

    const code = createOrderCode();
    const totalCents = subtotalCents + shippingSelection.shippingCents - discountCents;

    const order = await insertOrderWithShippingDetails(supabase, {
        code,
        user_id: user.id,
        customer_name: payload.customer.name,
        customer_email: payload.customer.email,
        customer_phone: customerPhone,
        customer_document: customerDocument,
        status: "pending_payment",
        payment_status: "pending",
        subtotal_cents: subtotalCents,
        shipping_cents: shippingSelection.shippingCents,
        discount_cents: discountCents,
        total_cents: totalCents,
        delivery_method: shippingSelection.deliveryMethod,
        delivery_address: shippingSelection.deliveryAddress ?? null,
        customer_notes: payload.notes || null,
        shipping_provider: shippingSelection.provider,
        shipping_service_id: shippingSelection.serviceId,
        shipping_service_name: shippingSelection.serviceName,
        shipping_company_name: shippingSelection.companyName,
        shipping_delivery_time_days: shippingSelection.deliveryTimeDays,
        shipping_origin_postal_code: shippingSelection.originPostalCode,
        shipping_destination_postal_code: shippingSelection.destinationPostalCode,
        shipping_quote: shippingSelection.quoteSnapshot
      });

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

    let preference: Awaited<ReturnType<typeof ensureMercadoPagoPreferenceForOrder>>;

    try {
      preference = await ensureMercadoPagoPreferenceForOrder({
        supabase,
        order: {
          id: order.id,
          code: order.code,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_phone: customerPhone,
          total_cents: order.total_cents
        },
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

    res.status(201).json({
      order: {
        id: order.id,
        code: order.code,
        status: order.status,
        paymentStatus: order.payment_status,
        totalCents: order.total_cents,
        discountCents: order.discount_cents,
        shippingCents: order.shipping_cents,
        deliveryMethod: order.delivery_method
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
      throw new HttpError(401, "LOGIN_REQUIRED", "Sua sessão expirou. Entre novamente.");
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
      throw new HttpError(404, "ORDER_NOT_FOUND", "Pedido não encontrado para esta conta.");
    }

    const { order: updatedOrder } = await syncMercadoPagoPaymentForOrder({
      supabase,
      order,
      paymentId
    });

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
