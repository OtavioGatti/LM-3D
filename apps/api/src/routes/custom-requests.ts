import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { formatBrazilianPhone, PICKUP_SHIPPING_OPTION } from "@lm-3d/shared";
import { HttpError } from "../lib/http.js";
import { ensureMercadoPagoPreferenceForOrder } from "../lib/order-payments.js";
import {
  getStoreOriginPostalCode,
  normalizePostalCode,
  quoteMelhorEnvioShipping,
  toPublicShippingOption
} from "../lib/melhor-envio.js";
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

const customRequestShippingQuoteSchema = z.object({
  address: z.object({
    postalCode: z.string().trim().min(1).max(30)
  })
});

const customRequestCheckoutSchema = z.object({
  customer: z.object({
    phone: z.string().trim().max(40).optional().nullable(),
    document: z.string().trim().max(30).optional().nullable()
  }),
  delivery: z.object({
    method: z.enum(["retirada", "melhor_envio"]),
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
    .nullable()
});

export const customRequestsRouter = Router();

function createRequestCode() {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  return `ORC-${suffix}`;
}

type CustomRequestRow = {
  id: string;
  code: string;
  user_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  title: string;
  description: string;
  quantity: number;
  desired_material: string | null;
  desired_colors: string | null;
  deadline: string | null;
  reference_url: string | null;
  status: string;
  estimated_price_cents: number | null;
  admin_notes: string | null;
  quoted_deadline?: string | null;
  quoted_weight_grams?: number | null;
  quoted_package_width_cm?: number | null;
  quoted_package_height_cm?: number | null;
  quoted_package_length_cm?: number | null;
};

type CustomRequestCheckoutPayload = z.infer<typeof customRequestCheckoutSchema>;

function isMissingCustomRequestShippingColumn(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  return /quoted_(weight_grams|package_(width|height|length)_cm)/.test(String(error.message));
}

function buildCustomRequestQuoteProduct(request: CustomRequestRow) {
  return {
    id: request.id,
    name: request.title,
    price_cents: request.estimated_price_cents ?? 0,
    quantity: 1,
    weight_grams: request.quoted_weight_grams ?? null,
    package_width_cm: request.quoted_package_width_cm ?? null,
    package_height_cm: request.quoted_package_height_cm ?? null,
    package_length_cm: request.quoted_package_length_cm ?? null
  };
}

async function loadPayableCustomRequest({
  supabase,
  code,
  userId
}: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  code: string;
  userId: string;
}) {
  const fullSelect = `
    *,
    quoted_weight_grams,
    quoted_package_width_cm,
    quoted_package_height_cm,
    quoted_package_length_cm
  `;
  let { data, error } = await supabase
    .from("custom_requests")
    .select(fullSelect)
    .eq("code", code)
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isMissingCustomRequestShippingColumn(error)) {
    const fallback = await supabase
      .from("custom_requests")
      .select("*")
      .eq("code", code)
      .eq("user_id", userId)
      .maybeSingle();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "CUSTOM_REQUEST_NOT_FOUND", "Orcamento nao encontrado.");
  }

  const request = data as CustomRequestRow;

  if (request.status !== "quoted" || !request.estimated_price_cents) {
    throw new HttpError(
      400,
      "CUSTOM_REQUEST_NOT_PAYABLE",
      "Este orcamento ainda nao esta liberado para pagamento."
    );
  }

  return request;
}

function ensureCustomRequestCanQuoteShipping(request: CustomRequestRow) {
  const missing =
    !request.quoted_weight_grams ||
    !request.quoted_package_width_cm ||
    !request.quoted_package_height_cm ||
    !request.quoted_package_length_cm;

  if (missing) {
    throw new HttpError(
      400,
      "CUSTOM_REQUEST_SHIPPING_PACKAGE_REQUIRED",
      "Este orcamento ainda precisa de peso e medidas de pacote para calcular frete."
    );
  }
}

function resolveCustomRequestAddress(payload: CustomRequestCheckoutPayload) {
  if (payload.delivery.method === "retirada") {
    return {
      shippingCents: 0,
      deliveryMethod: PICKUP_SHIPPING_OPTION.label,
      deliveryAddress: null,
      provider: "pickup" as const,
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

  const address = payload.delivery.address;

  if (
    !address?.line1 ||
    !address.number ||
    !address.district ||
    !address.city ||
    !address.state ||
    !address.postalCode
  ) {
    throw new HttpError(
      400,
      "SHIPPING_ADDRESS_REQUIRED",
      "Preencha rua, numero, bairro, cidade, estado e CEP para envio."
    );
  }

  if (payload.shipping?.provider !== "melhor_envio" || !payload.shipping.serviceId) {
    throw new HttpError(400, "SHIPPING_OPTION_REQUIRED", "Escolha uma opcao de frete.");
  }

  return null;
}

async function resolveCustomRequestShippingSelection({
  request,
  payload
}: {
  request: CustomRequestRow;
  payload: CustomRequestCheckoutPayload;
}) {
  const pickup = resolveCustomRequestAddress(payload);

  if (pickup) {
    return pickup;
  }

  ensureCustomRequestCanQuoteShipping(request);

  const destinationPostalCode = normalizePostalCode(payload.delivery.address!.postalCode!);
  const originPostalCode = getStoreOriginPostalCode();
  const quote = await quoteMelhorEnvioShipping({
    destinationPostalCode,
    products: [buildCustomRequestQuoteProduct(request)]
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
      "A opcao de frete escolhida nao esta mais disponivel. Calcule o frete novamente."
    );
  }

  return {
    shippingCents: selectedOption.priceCents,
    deliveryMethod: selectedOption.label,
    deliveryAddress: payload.delivery.address ?? null,
    provider: "melhor_envio" as const,
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

customRequestsRouter.post("/:code/shipping-quote", async (req, res, next) => {
  try {
    const { code } = z.object({ code: z.string().trim().min(1).max(40) }).parse(req.params);
    const payload = customRequestShippingQuoteSchema.parse(req.body);
    const supabase = getSupabaseAdminClient();
    const token = getBearerToken(req.header("authorization"));

    if (!token) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Entre para calcular o frete do orcamento.");
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Sua sessao expirou. Entre novamente.");
    }

    const request = await loadPayableCustomRequest({
      supabase,
      code,
      userId: user.id
    });

    ensureCustomRequestCanQuoteShipping(request);

    const quote = await quoteMelhorEnvioShipping({
      destinationPostalCode: normalizePostalCode(payload.address.postalCode),
      products: [buildCustomRequestQuoteProduct(request)]
    });

    res.json({
      options: [PICKUP_SHIPPING_OPTION, ...quote.options.map(toPublicShippingOption)],
      unavailableServices: quote.unavailableServices
    });
  } catch (error) {
    next(error);
  }
});

customRequestsRouter.post("/:code/checkout", async (req, res, next) => {
  try {
    const { code } = z.object({ code: z.string().trim().min(1).max(40) }).parse(req.params);
    const payload = customRequestCheckoutSchema.parse(req.body);
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

    const { data: legacyRequest, error: requestError } = await supabase
      .from("custom_requests")
      .select("*")
      .eq("code", code)
      .eq("user_id", user.id)
      .maybeSingle();

    if (requestError) {
      throw requestError;
    }

    if (!legacyRequest) {
      throw new HttpError(404, "CUSTOM_REQUEST_NOT_FOUND", "Orçamento não encontrado.");
    }

    const request = await loadPayableCustomRequest({
      supabase,
      code,
      userId: user.id
    });

    if (request.status !== "quoted" || !request.estimated_price_cents) {
      throw new HttpError(
        400,
        "CUSTOM_REQUEST_NOT_PAYABLE",
        "Este orçamento ainda não está liberado para pagamento."
      );
    }

    const customerEmail = request.customer_email ?? user.email;
    const customerPhone = payload.customer.phone
      ? formatBrazilianPhone(payload.customer.phone)
      : request.customer_phone;
    const customerDocument = payload.customer.document?.replace(/\D/g, "") || null;

    if (!customerEmail) {
      throw new HttpError(
        400,
        "CUSTOM_REQUEST_WITHOUT_EMAIL",
        "Este orçamento precisa de um e-mail para gerar o pagamento."
      );
    }

    if (payload.delivery.method === "melhor_envio" && !customerPhone) {
      throw new HttpError(400, "CUSTOMER_PHONE_REQUIRED", "Informe o telefone para gerar a etiqueta.");
    }

    if (payload.delivery.method === "melhor_envio" && !customerDocument) {
      throw new HttpError(400, "CUSTOMER_DOCUMENT_REQUIRED", "Informe CPF ou CNPJ para gerar a etiqueta.");
    }

    const shippingSelection = await resolveCustomRequestShippingSelection({
      request,
      payload
    });
    const totalCents = request.estimated_price_cents + shippingSelection.shippingCents;

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
          customer_phone: customerPhone,
          customer_document: customerDocument,
          status: "pending_payment",
          payment_status: "pending",
          subtotal_cents: request.estimated_price_cents,
          shipping_cents: shippingSelection.shippingCents,
          discount_cents: 0,
          total_cents: totalCents,
          delivery_method: shippingSelection.deliveryMethod,
          delivery_address: shippingSelection.deliveryAddress,
          customer_notes: `Orçamento ${request.code}: ${request.description}`,
          admin_notes: request.admin_notes,
          shipping_provider: shippingSelection.provider,
          shipping_service_id: shippingSelection.serviceId,
          shipping_service_name: shippingSelection.serviceName,
          shipping_company_name: shippingSelection.companyName,
          shipping_delivery_time_days: shippingSelection.deliveryTimeDays,
          shipping_origin_postal_code: shippingSelection.originPostalCode,
          shipping_destination_postal_code: shippingSelection.destinationPostalCode,
          shipping_quote: shippingSelection.quoteSnapshot
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
          quoted_weight_grams: request.quoted_weight_grams ?? null,
          quoted_package_width_cm: request.quoted_package_width_cm ?? null,
          quoted_package_height_cm: request.quoted_package_height_cm ?? null,
          quoted_package_length_cm: request.quoted_package_length_cm ?? null,
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
    } else if (order.payment_status !== "approved") {
      const { data: updatedOrder, error: updateOrderError } = await supabase
        .from("orders")
        .update({
          customer_phone: customerPhone,
          customer_document: customerDocument,
          subtotal_cents: request.estimated_price_cents,
          shipping_cents: shippingSelection.shippingCents,
          discount_cents: 0,
          total_cents: totalCents,
          delivery_method: shippingSelection.deliveryMethod,
          delivery_address: shippingSelection.deliveryAddress,
          shipping_provider: shippingSelection.provider,
          shipping_service_id: shippingSelection.serviceId,
          shipping_service_name: shippingSelection.serviceName,
          shipping_company_name: shippingSelection.companyName,
          shipping_delivery_time_days: shippingSelection.deliveryTimeDays,
          shipping_origin_postal_code: shippingSelection.originPostalCode,
          shipping_destination_postal_code: shippingSelection.destinationPostalCode,
          shipping_quote: shippingSelection.quoteSnapshot,
          shipping_melhor_envio_order_id: null,
          shipping_melhor_envio_protocol: null,
          shipping_melhor_envio_purchase_id: null,
          shipping_melhor_envio_purchase_protocol: null,
          shipping_melhor_envio_purchase_status: null,
          shipping_label_status: null,
          shipping_label_created_at: null,
          shipping_label_purchased_at: null,
          shipping_label_error: null,
          shipping_label_payload: {}
        })
        .eq("id", order.id)
        .select("*")
        .single();

      if (updateOrderError) {
        throw updateOrderError;
      }

      const { error: paymentDeleteError } = await supabase
        .from("payments")
        .delete()
        .eq("order_id", order.id)
        .neq("status", "approved");

      if (paymentDeleteError) {
        throw paymentDeleteError;
      }

      order = updatedOrder;
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
        totalCents: order.total_cents,
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
