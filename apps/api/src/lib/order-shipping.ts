import { env } from "../config/env.js";
import { HttpError } from "./http.js";
import {
  checkoutMelhorEnvioShipment,
  createMelhorEnvioCartItem,
  getMelhorEnvioSenderAddress,
  normalizeDocument,
  normalizePhone,
  normalizePostalCode,
  type MelhorEnvioAddressPayload,
  type MelhorEnvioCartPayload,
  type MelhorEnvioCartVolumePayload
} from "./melhor-envio.js";
import type { SupabaseAdminClient } from "./supabase.js";

type ShippingLabelStatus =
  | "pending"
  | "creating"
  | "cart_created"
  | "purchasing"
  | "purchased"
  | "failed";

type DeliveryAddress = {
  line1?: unknown;
  number?: unknown;
  district?: unknown;
  complement?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
};

type OrderItemRow = {
  id: string;
  quantity: number;
  unit_price_cents: number;
  product_snapshot: unknown;
};

type PaidShippingOrder = {
  id: string;
  code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_document: string | null;
  subtotal_cents: number;
  payment_status: string;
  shipping_provider: string | null;
  shipping_service_id: string | null;
  shipping_quote: unknown;
  delivery_address: unknown;
  shipping_melhor_envio_order_id: string | null;
  shipping_melhor_envio_purchase_id: string | null;
  shipping_label_status: ShippingLabelStatus | null;
  shipping_label_payload: Record<string, unknown> | null;
  order_items: OrderItemRow[];
};

export type MelhorEnvioShipmentSyncResult =
  | { status: "skipped"; reason: string }
  | { status: "in_progress"; reason: string }
  | { status: "cart_created"; orderId: string }
  | { status: "purchased"; orderId: string; purchaseId: string | null }
  | { status: "failed"; message: string };

function isMissingShipmentColumn(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  return /customer_document|shipping_(melhor_envio|label)/.test(String(error.message));
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asPositiveNumber(value: unknown) {
  const numberValue =
    typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function requireOrderValue(value: string, field: string) {
  if (!value) {
    throw new HttpError(
      400,
      "ORDER_SHIPPING_DATA_REQUIRED",
      `Preencha ${field} do pedido para gerar a etiqueta no Melhor Envio.`
    );
  }

  return value;
}

function normalizeState(value: string) {
  const state = value.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(state)) {
    throw new HttpError(
      400,
      "ORDER_SHIPPING_DATA_REQUIRED",
      "Preencha o estado do destinatario com 2 letras, por exemplo SP."
    );
  }

  return state;
}

function splitAddressLine(address: DeliveryAddress) {
  const rawLine = asString(address.line1);
  const explicitNumber = asString(address.number);
  const explicitDistrict = asString(address.district);
  const parts = rawLine
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  let street = parts[0] ?? rawLine;
  let number = explicitNumber || parts[1] || "";
  let district = explicitDistrict || (parts.length > 2 ? parts.slice(2).join(", ") : "");

  if (!number && street) {
    const match = street.match(/^(.*?)[,\s]+(\d+[a-zA-Z0-9/-]*)$/);

    if (match?.[1] && match[2]) {
      street = match[1].trim();
      number = match[2].trim();
    }
  }

  return {
    street,
    number,
    district
  };
}

function getDeliveryAddress(order: PaidShippingOrder): DeliveryAddress {
  const address = asRecord(order.delivery_address);

  return address ?? {};
}

function buildRecipientAddress(order: PaidShippingOrder): MelhorEnvioAddressPayload {
  const address = getDeliveryAddress(order);
  const { street, number, district } = splitAddressLine(address);
  const document = normalizeDocument(order.customer_document);
  const phone = normalizePhone(order.customer_phone);
  const complement = asString(address.complement);
  const recipient: MelhorEnvioAddressPayload = {
    name: requireOrderValue(order.customer_name.trim(), "o nome do destinatario"),
    phone: requireOrderValue(phone, "o telefone do destinatario"),
    email: requireOrderValue(order.customer_email.trim(), "o e-mail do destinatario"),
    document: requireOrderValue(document, "o CPF ou CNPJ do destinatario"),
    address: requireOrderValue(street, "a rua/avenida do destinatario"),
    number: requireOrderValue(number, "o numero do endereco do destinatario"),
    district: requireOrderValue(district, "o bairro do destinatario"),
    city: requireOrderValue(asString(address.city), "a cidade do destinatario"),
    country_id: "BR",
    postal_code: normalizePostalCode(
      requireOrderValue(asString(address.postalCode), "o CEP do destinatario")
    ),
    state_abbr: normalizeState(
      requireOrderValue(asString(address.state), "o estado do destinatario")
    )
  };

  if (complement) {
    recipient.complement = complement;
  }

  return recipient;
}

function getPackageList(order: PaidShippingOrder) {
  const quote = asRecord(order.shipping_quote);
  const rawQuote = asRecord(quote?.rawQuote);
  const directPackages = quote?.packages;
  const rawPackages = rawQuote?.packages;

  if (Array.isArray(directPackages) && directPackages.length > 0) {
    return directPackages;
  }

  if (Array.isArray(rawPackages) && rawPackages.length > 0) {
    return rawPackages;
  }

  return [];
}

function buildCartVolumes(order: PaidShippingOrder): MelhorEnvioCartVolumePayload[] {
  const packages = getPackageList(order);
  const volumes = packages.map((item) => {
    const record = asRecord(item);
    const dimensions = asRecord(record?.dimensions);
    const height = asPositiveNumber(dimensions?.height);
    const width = asPositiveNumber(dimensions?.width);
    const length = asPositiveNumber(dimensions?.length);
    const weight = asPositiveNumber(record?.weight);

    if (!height || !width || !length || !weight) {
      return null;
    }

    return {
      height,
      width,
      length,
      weight
    };
  });

  const validVolumes = volumes.filter(
    (volume): volume is MelhorEnvioCartVolumePayload => Boolean(volume)
  );

  if (validVolumes.length === 0) {
    throw new HttpError(
      400,
      "ORDER_SHIPPING_PACKAGES_REQUIRED",
      "A cotacao salva nao tem os volumes necessarios para criar a etiqueta. Recalcule o frete e crie um novo pedido."
    );
  }

  return validVolumes;
}

function getSnapshotName(snapshot: unknown) {
  const record = asRecord(snapshot);
  const name = asString(record?.name);

  return name || "Produto LM-3D";
}

function buildCartProducts(order: PaidShippingOrder) {
  return order.order_items.map((item) => ({
    name: getSnapshotName(item.product_snapshot),
    quantity: item.quantity,
    unitary_value: Math.max(0.01, item.unit_price_cents / 100)
  }));
}

function getServiceId(order: PaidShippingOrder) {
  const serviceId = Number(order.shipping_service_id);

  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw new HttpError(
      400,
      "ORDER_SHIPPING_SERVICE_REQUIRED",
      "A opcao de frete do pedido nao tem um servico valido do Melhor Envio."
    );
  }

  return serviceId;
}

function buildCartPayload(order: PaidShippingOrder): MelhorEnvioCartPayload {
  const payload: MelhorEnvioCartPayload = {
    service: getServiceId(order),
    from: getMelhorEnvioSenderAddress(),
    to: buildRecipientAddress(order),
    products: buildCartProducts(order),
    volumes: buildCartVolumes(order),
    options: {
      receipt: false,
      own_hand: false,
      insurance_value: Math.max(1, order.subtotal_cents / 100),
      non_commercial: true
    }
  };

  if (env.MELHOR_ENVIO_POSTING_AGENCY_ID) {
    payload.agency = env.MELHOR_ENVIO_POSTING_AGENCY_ID;
  }

  return payload;
}

async function loadPaidShippingOrder(supabase: SupabaseAdminClient, orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
        id,
        code,
        customer_name,
        customer_email,
        customer_phone,
        customer_document,
        subtotal_cents,
        payment_status,
        shipping_provider,
        shipping_service_id,
        shipping_quote,
        delivery_address,
        shipping_melhor_envio_order_id,
        shipping_melhor_envio_purchase_id,
        shipping_label_status,
        shipping_label_payload,
        order_items (
          id,
          quantity,
          unit_price_cents,
          product_snapshot
        )
      `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    if (isMissingShipmentColumn(error)) {
      return null;
    }

    throw error;
  }

  return data as PaidShippingOrder | null;
}

async function claimCartCreation(supabase: SupabaseAdminClient, orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .update({
      shipping_label_status: "creating",
      shipping_label_error: null
    })
    .eq("id", orderId)
    .is("shipping_melhor_envio_order_id", null)
    .or("shipping_label_status.is.null,shipping_label_status.eq.pending,shipping_label_status.eq.failed")
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function claimCheckout(supabase: SupabaseAdminClient, orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .update({
      shipping_label_status: "purchasing",
      shipping_label_error: null
    })
    .eq("id", orderId)
    .not("shipping_melhor_envio_order_id", "is", null)
    .is("shipping_melhor_envio_purchase_id", null)
    .or("shipping_label_status.is.null,shipping_label_status.eq.cart_created,shipping_label_status.eq.failed")
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function updateShipmentFailure({
  supabase,
  order,
  error
}: {
  supabase: SupabaseAdminClient;
  order: PaidShippingOrder;
  error: unknown;
}): Promise<MelhorEnvioShipmentSyncResult> {
  const message =
    error instanceof Error
      ? error.message
      : "Nao foi possivel sincronizar a etiqueta com o Melhor Envio.";

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      shipping_label_status: "failed",
      shipping_label_error: message,
      shipping_label_payload: {
        ...(order.shipping_label_payload ?? {}),
        last_error: {
          message,
          at: new Date().toISOString()
        }
      }
    })
    .eq("id", order.id);

  if (updateError && !isMissingShipmentColumn(updateError)) {
    throw updateError;
  }

  return {
    status: "failed",
    message
  };
}

export async function ensureMelhorEnvioShipmentForPaidOrder({
  supabase,
  orderId
}: {
  supabase: SupabaseAdminClient;
  orderId: string;
}): Promise<MelhorEnvioShipmentSyncResult> {
  const order = await loadPaidShippingOrder(supabase, orderId);

  if (!order) {
    return {
      status: "skipped",
      reason: "As colunas de etiqueta do Melhor Envio ainda nao existem no banco."
    };
  }

  if (order.payment_status !== "approved") {
    return {
      status: "skipped",
      reason: "Pedido ainda nao esta com pagamento aprovado."
    };
  }

  if (order.shipping_provider !== "melhor_envio") {
    return {
      status: "skipped",
      reason: "Pedido nao usa frete do Melhor Envio."
    };
  }

  if (order.shipping_label_status === "purchased") {
    return {
      status: "purchased",
      orderId: order.shipping_melhor_envio_order_id ?? "",
      purchaseId: order.shipping_melhor_envio_purchase_id
    };
  }

  let melhorEnvioOrderId = order.shipping_melhor_envio_order_id;
  let payload = order.shipping_label_payload ?? {};

  if (!melhorEnvioOrderId) {
    const claimed = await claimCartCreation(supabase, order.id);

    if (!claimed) {
      return {
        status: "in_progress",
        reason: "Outra verificacao ja esta criando a etiqueta."
      };
    }

    try {
      const cartPayload = buildCartPayload(order);
      const cartResponse = await createMelhorEnvioCartItem(cartPayload);
      melhorEnvioOrderId = String(cartResponse.id);
      payload = {
        ...payload,
        cart: cartResponse
      };

      const { error: cartUpdateError } = await supabase
        .from("orders")
        .update({
          shipping_melhor_envio_order_id: melhorEnvioOrderId,
          shipping_melhor_envio_protocol:
            cartResponse.protocol === undefined || cartResponse.protocol === null
              ? null
              : String(cartResponse.protocol),
          shipping_label_status: "cart_created",
          shipping_label_created_at: new Date().toISOString(),
          shipping_label_error: null,
          shipping_label_payload: payload
        })
        .eq("id", order.id);

      if (cartUpdateError) {
        throw cartUpdateError;
      }
    } catch (error) {
      return updateShipmentFailure({ supabase, order, error });
    }
  }

  if (!melhorEnvioOrderId) {
    return {
      status: "failed",
      message: "O Melhor Envio nao retornou o ID da etiqueta."
    };
  }

  const checkoutClaimed = await claimCheckout(supabase, order.id);

  if (!checkoutClaimed) {
    return {
      status: "cart_created",
      orderId: melhorEnvioOrderId
    };
  }

  try {
    const checkoutResponse = await checkoutMelhorEnvioShipment([melhorEnvioOrderId]);
    const purchase = checkoutResponse.purchase ?? null;
    const purchaseId =
      purchase?.id === undefined || purchase?.id === null ? null : String(purchase.id);
    const purchaseProtocol =
      purchase?.protocol === undefined || purchase?.protocol === null
        ? null
        : String(purchase.protocol);

    const { error: checkoutUpdateError } = await supabase
      .from("orders")
      .update({
        shipping_melhor_envio_purchase_id: purchaseId,
        shipping_melhor_envio_purchase_protocol: purchaseProtocol,
        shipping_melhor_envio_purchase_status: purchase?.status ?? "purchased",
        shipping_label_status: "purchased",
        shipping_label_purchased_at: new Date().toISOString(),
        shipping_label_error: null,
        shipping_label_payload: {
          ...payload,
          checkout: checkoutResponse
        }
      })
      .eq("id", order.id);

    if (checkoutUpdateError) {
      throw checkoutUpdateError;
    }

    return {
      status: "purchased",
      orderId: melhorEnvioOrderId,
      purchaseId
    };
  } catch (error) {
    return updateShipmentFailure({
      supabase,
      order: {
        ...order,
        shipping_melhor_envio_order_id: melhorEnvioOrderId,
        shipping_label_payload: payload
      },
      error
    });
  }
}
