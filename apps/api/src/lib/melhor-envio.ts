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

export async function quoteMelhorEnvioShipping({
  destinationPostalCode,
  products
}: {
  destinationPostalCode: string;
  products: MelhorEnvioQuoteProduct[];
}): Promise<MelhorEnvioQuoteResult> {
  const originPostalCode = getStoreOriginPostalCode();
  const token = getAccessToken();
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
    const message =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : "Nao foi possivel calcular o frete no Melhor Envio.";

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
