import type { ShippingQuoteOption } from "@lm-3d/shared";
import { env } from "../config/env.js";
import { HttpError } from "./http.js";

type MelhorEnvioQuoteProduct = {
  id: string;
  name: string;
  price_cents: number;
  quantity: number;
  weight_grams: number | null;
  package_width_cm?: number | null;
  package_height_cm?: number | null;
  package_length_cm?: number | null;
};

type MelhorEnvioQuoteItem = {
  id?: string | number;
  name?: string | null;
  price?: string | number | null;
  custom_price?: string | number | null;
  delivery_time?: string | number | null;
  custom_delivery_time?: string | number | null;
  company?: {
    name?: string | null;
  } | null;
  packages?: unknown[];
  error?: string | null;
};

export type MelhorEnvioAddressPayload = {
  name: string;
  phone: string;
  email: string;
  document?: string;
  company_document?: string;
  state_register?: string;
  address: string;
  complement?: string;
  number: string;
  district: string;
  city: string;
  country_id: string;
  postal_code: string;
  state_abbr: string;
};

export type MelhorEnvioCartProductPayload = {
  name: string;
  quantity: number;
  unitary_value: number;
  weight?: number;
};

export type MelhorEnvioCartVolumePayload = {
  height: number;
  width: number;
  length: number;
  weight: number;
};

export type MelhorEnvioCartPayload = {
  service: number;
  agency?: number;
  from: MelhorEnvioAddressPayload;
  to: MelhorEnvioAddressPayload;
  products: MelhorEnvioCartProductPayload[];
  volumes: MelhorEnvioCartVolumePayload[];
  options: {
    receipt: boolean;
    own_hand: boolean;
    insurance_value: number;
    non_commercial: boolean;
  };
};

export type MelhorEnvioCartResponse = {
  id?: string | number | null;
  protocol?: string | number | null;
  status?: string | null;
  [key: string]: unknown;
};

export type MelhorEnvioCheckoutResponse = {
  purchase?: {
    id?: string | number | null;
    protocol?: string | number | null;
    status?: string | null;
    orders?: Array<{ id?: string | number | null }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type MelhorEnvioTrackingResponse = unknown;

export type MelhorEnvioShippingOption = ShippingQuoteOption & {
  rawQuote: MelhorEnvioQuoteItem;
  packages: unknown[];
};

export type MelhorEnvioQuoteResult = {
  options: MelhorEnvioShippingOption[];
  unavailableServices: Array<{
    serviceName: string;
    companyName: string | null;
    message: string;
  }>;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeDocument(value: string | null | undefined) {
  return value ? onlyDigits(value) : "";
}

export function normalizePhone(value: string | null | undefined) {
  return value ? onlyDigits(value) : "";
}

export function normalizePostalCode(value: string) {
  const postalCode = onlyDigits(value);

  if (postalCode.length !== 8) {
    throw new HttpError(400, "INVALID_POSTAL_CODE", "Informe um CEP valido com 8 digitos.");
  }

  return postalCode;
}

export function isMelhorEnvioConfigured() {
  return Boolean(env.MELHOR_ENVIO_ACCESS_TOKEN && env.STORE_ORIGIN_POSTAL_CODE);
}

export function getStoreOriginPostalCode() {
  if (!env.STORE_ORIGIN_POSTAL_CODE) {
    throw new HttpError(
      503,
      "STORE_ORIGIN_POSTAL_CODE_NOT_CONFIGURED",
      "Configure o CEP de origem da loja para calcular fretes."
    );
  }

  return normalizePostalCode(env.STORE_ORIGIN_POSTAL_CODE);
}

function getAccessToken() {
  if (!env.MELHOR_ENVIO_ACCESS_TOKEN) {
    throw new HttpError(
      503,
      "MELHOR_ENVIO_NOT_CONFIGURED",
      "Configure o token do Melhor Envio para calcular fretes."
    );
  }

  return env.MELHOR_ENVIO_ACCESS_TOKEN;
}

function requiredConfig(value: string | undefined, name: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new HttpError(
      503,
      "MELHOR_ENVIO_SENDER_NOT_CONFIGURED",
      `Configure ${name} no Render para gerar etiquetas no Melhor Envio.`
    );
  }

  return trimmed;
}

function normalizeStateAbbr(value: string) {
  const state = value.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(state)) {
    throw new HttpError(
      400,
      "INVALID_STATE_ABBR",
      "Informe o estado do envio com 2 letras, por exemplo SP."
    );
  }

  return state;
}

export function getMelhorEnvioSenderAddress(): MelhorEnvioAddressPayload {
  const sender: MelhorEnvioAddressPayload = {
    name: requiredConfig(env.MELHOR_ENVIO_SENDER_NAME, "MELHOR_ENVIO_SENDER_NAME"),
    phone: normalizePhone(requiredConfig(env.MELHOR_ENVIO_SENDER_PHONE, "MELHOR_ENVIO_SENDER_PHONE")),
    email: requiredConfig(env.MELHOR_ENVIO_SENDER_EMAIL, "MELHOR_ENVIO_SENDER_EMAIL"),
    address: requiredConfig(env.MELHOR_ENVIO_SENDER_ADDRESS, "MELHOR_ENVIO_SENDER_ADDRESS"),
    number: requiredConfig(env.MELHOR_ENVIO_SENDER_NUMBER, "MELHOR_ENVIO_SENDER_NUMBER"),
    district: requiredConfig(env.MELHOR_ENVIO_SENDER_DISTRICT, "MELHOR_ENVIO_SENDER_DISTRICT"),
    city: requiredConfig(env.MELHOR_ENVIO_SENDER_CITY, "MELHOR_ENVIO_SENDER_CITY"),
    country_id: "BR",
    postal_code: getStoreOriginPostalCode(),
    state_abbr: normalizeStateAbbr(
      requiredConfig(env.MELHOR_ENVIO_SENDER_STATE, "MELHOR_ENVIO_SENDER_STATE")
    )
  };
  const document = normalizeDocument(env.MELHOR_ENVIO_SENDER_DOCUMENT);
  const companyDocument = normalizeDocument(env.MELHOR_ENVIO_SENDER_COMPANY_DOCUMENT);
  const complement = env.MELHOR_ENVIO_SENDER_COMPLEMENT?.trim();
  const stateRegister = env.MELHOR_ENVIO_SENDER_STATE_REGISTER?.trim();

  if (document) {
    sender.document = document;
  }

  if (companyDocument) {
    sender.company_document = companyDocument;
  }

  if (stateRegister) {
    sender.state_register = stateRegister;
  }

  if (complement) {
    sender.complement = complement;
  }

  return sender;
}

function toPositiveNumber(value: unknown) {
  const numberValue =
    typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;

  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function toMoneyCents(value: unknown) {
  const numberValue =
    typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return Math.round(numberValue * 100);
}

function toNullableInteger(value: unknown) {
  const numberValue =
    typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;

  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.round(numberValue) : null;
}

function getPackageDimensions(product: MelhorEnvioQuoteProduct) {
  const width = toPositiveNumber(product.package_width_cm);
  const height = toPositiveNumber(product.package_height_cm);
  const length = toPositiveNumber(product.package_length_cm);
  const weightGrams = toPositiveNumber(product.weight_grams);

  if (!width || !height || !length || !weightGrams) {
    throw new HttpError(
      400,
      "PRODUCT_SHIPPING_DATA_REQUIRED",
      `Preencha peso e medidas de pacote do produto "${product.name}" antes de calcular o frete.`
    );
  }

  return {
    width,
    height,
    length,
    weight: weightGrams / 1000
  };
}

function buildProductPayload(product: MelhorEnvioQuoteProduct) {
  const dimensions = getPackageDimensions(product);

  return {
    id: product.id,
    width: dimensions.width,
    height: dimensions.height,
    length: dimensions.length,
    weight: dimensions.weight,
    insurance_value: Math.max(1, product.price_cents / 100),
    quantity: product.quantity
  };
}

function getAllowedServicesPayload() {
  const services = env.MELHOR_ENVIO_ALLOWED_SERVICES?.trim();

  if (!services) {
    return undefined;
  }

  return services
    .split(",")
    .map((service) => service.trim())
    .filter(Boolean)
    .join(",");
}

function mapQuoteItem(item: MelhorEnvioQuoteItem): MelhorEnvioShippingOption | null {
  const serviceId = item.id === undefined || item.id === null ? null : String(item.id);
  const serviceName = item.name?.trim() || "Servico de entrega";
  const companyName = item.company?.name?.trim() || null;
  const priceCents = toMoneyCents(item.custom_price ?? item.price);

  if (!serviceId || priceCents === null || item.error) {
    return null;
  }

  return {
    id: `melhor-envio:${serviceId}`,
    provider: "melhor_envio",
    serviceId,
    serviceName,
    companyName,
    label: companyName ? `${companyName} - ${serviceName}` : serviceName,
    priceCents,
    deliveryTimeDays: toNullableInteger(item.custom_delivery_time ?? item.delivery_time),
    rawQuote: item,
    packages: item.packages ?? []
  };
}

function mapUnavailableQuoteItem(item: MelhorEnvioQuoteItem) {
  if (!item.error) {
    return null;
  }

  return {
    serviceName: item.name?.trim() || "Servico de entrega",
    companyName: item.company?.name?.trim() || null,
    message: item.error
  };
}

async function readMelhorEnvioResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getProviderMessage(data: unknown, fallback: string) {
  if (!data) {
    return fallback;
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object") {
    if ("message" in data && typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }

    const errors = "errors" in data ? data.errors : "error" in data ? data.error : null;

    if (errors && typeof errors === "object") {
      for (const value of Object.values(errors)) {
        if (Array.isArray(value) && typeof value[0] === "string") {
          return value[0];
        }

        if (typeof value === "string") {
          return value;
        }
      }
    }
  }

  return fallback;
}

async function requestMelhorEnvio<T>({
  path,
  body,
  errorCode,
  fallbackMessage,
  timeoutMs = 20000
}: {
  path: string;
  body: unknown;
  errorCode: string;
  fallbackMessage: string;
  timeoutMs?: number;
}) {
  const token = getAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(`${env.MELHOR_ENVIO_BASE_URL}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": env.MELHOR_ENVIO_USER_AGENT
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(
        504,
        "MELHOR_ENVIO_TIMEOUT",
        "O Melhor Envio demorou para responder. Tente novamente."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await readMelhorEnvioResponse(response);

  if (!response.ok) {
    const providerMessage = getProviderMessage(data, fallbackMessage);
    const message =
      response.status === 401 || /^unauthenticated\.?$/i.test(providerMessage.trim())
        ? "Melhor Envio recusou o token de API. Confira MELHOR_ENVIO_ACCESS_TOKEN, MELHOR_ENVIO_BASE_URL e os escopos do aplicativo."
        : providerMessage;

    throw new HttpError(response.status, errorCode, message);
  }

  return data as T;
}

export function toPublicShippingOption(option: MelhorEnvioShippingOption): ShippingQuoteOption {
  return {
    id: option.id,
    provider: option.provider,
    serviceId: option.serviceId,
    serviceName: option.serviceName,
    companyName: option.companyName,
    label: option.label,
    priceCents: option.priceCents,
    deliveryTimeDays: option.deliveryTimeDays
  };
}

export async function createMelhorEnvioCartItem(payload: MelhorEnvioCartPayload) {
  const response = await requestMelhorEnvio<MelhorEnvioCartResponse>({
    path: "/api/v2/me/cart",
    body: payload,
    errorCode: "MELHOR_ENVIO_CART_FAILED",
    fallbackMessage: "Nao foi possivel inserir o frete no carrinho do Melhor Envio."
  });
  const orderId = response.id === undefined || response.id === null ? "" : String(response.id);

  if (!orderId) {
    throw new HttpError(
      502,
      "MELHOR_ENVIO_CART_INVALID_RESPONSE",
      "O Melhor Envio nao retornou o ID da etiqueta criada."
    );
  }

  return {
    ...response,
    id: orderId
  };
}

export async function checkoutMelhorEnvioShipment(orderIds: string[]) {
  return requestMelhorEnvio<MelhorEnvioCheckoutResponse>({
    path: "/api/v2/me/shipment/checkout",
    body: {
      orders: orderIds
    },
    errorCode: "MELHOR_ENVIO_CHECKOUT_FAILED",
    fallbackMessage: "Nao foi possivel comprar a etiqueta no Melhor Envio."
  });
}

export async function trackMelhorEnvioShipments(orderIds: string[]) {
  return requestMelhorEnvio<MelhorEnvioTrackingResponse>({
    path: "/api/v2/me/shipment/tracking",
    body: {
      orders: orderIds
    },
    errorCode: "MELHOR_ENVIO_TRACKING_FAILED",
    fallbackMessage: "Nao foi possivel consultar o rastreio no Melhor Envio."
  });
}

export async function quoteMelhorEnvioShipping({
  destinationPostalCode,
  products
}: {
  destinationPostalCode: string;
  products: MelhorEnvioQuoteProduct[];
}): Promise<MelhorEnvioQuoteResult> {
  const originPostalCode = getStoreOriginPostalCode();
  const token = getAccessToken();
  const allowedServices = getAllowedServicesPayload();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;

  try {
    response = await fetch(`${env.MELHOR_ENVIO_BASE_URL}/api/v2/me/shipment/calculate`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": env.MELHOR_ENVIO_USER_AGENT
      },
      body: JSON.stringify({
        from: {
          postal_code: originPostalCode
        },
        to: {
          postal_code: normalizePostalCode(destinationPostalCode)
        },
        ...(allowedServices ? { services: allowedServices } : {}),
        products: products.map(buildProductPayload)
      })
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError(
        504,
        "MELHOR_ENVIO_TIMEOUT",
        "O Melhor Envio demorou para responder. Tente calcular o frete novamente."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const providerMessage =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : "Nao foi possivel calcular o frete no Melhor Envio.";
    const message =
      response.status === 401 || /^unauthenticated\.?$/i.test(providerMessage.trim())
        ? "Melhor Envio recusou o token de API. Confira MELHOR_ENVIO_ACCESS_TOKEN e MELHOR_ENVIO_BASE_URL no Render."
        : providerMessage;

    throw new HttpError(response.status, "MELHOR_ENVIO_QUOTE_FAILED", message);
  }

  if (!Array.isArray(data)) {
    throw new HttpError(
      502,
      "MELHOR_ENVIO_INVALID_RESPONSE",
      "O Melhor Envio retornou uma resposta inesperada."
    );
  }

  const quoteItems = data as MelhorEnvioQuoteItem[];
  const options = quoteItems
    .map(mapQuoteItem)
    .filter((option): option is MelhorEnvioShippingOption => Boolean(option))
    .sort((first, second) => first.priceCents - second.priceCents);
  const unavailableServices = quoteItems
    .map(mapUnavailableQuoteItem)
    .filter((item): item is NonNullable<ReturnType<typeof mapUnavailableQuoteItem>> =>
      Boolean(item)
    );

  return {
    options,
    unavailableServices
  };
}
