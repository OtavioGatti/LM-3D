import type { ShippingQuoteResponse } from "@lm-3d/shared";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./base-url";

const apiBaseUrl = getApiBaseUrl();

export type CustomRequestPayload = {
  customer_name: string;
  customer_contact: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  title: string;
  description: string;
  quantity: number;
  desired_material?: string | null;
  desired_colors?: string | null;
  deadline?: string | null;
  reference_url?: string | null;
};

export type CustomRequestResponse = {
  request: {
    id: string;
    code: string;
    status: string;
  };
};

export type CustomRequestCheckoutResponse = {
  request: {
    id: string;
    code: string;
    status: string;
    estimatedPriceCents: number;
  };
  order: {
    id: string;
    code: string;
    status: string;
    paymentStatus: string;
    totalCents: number;
    shippingCents: number;
    deliveryMethod: string | null;
  };
  payment: {
    provider: "mercado_pago";
    preferenceId: string;
    checkoutUrl: string | null;
    sandboxCheckoutUrl: string | null;
  };
};

export type CustomRequestCheckoutPayload = {
  customer: {
    phone?: string | null;
    document?: string | null;
  };
  delivery: {
    method: "retirada" | "melhor_envio";
    address?: {
      line1?: string | null;
      number?: string | null;
      district?: string | null;
      complement?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
    } | null;
  };
  shipping?: {
    optionId: string;
    provider: "pickup" | "melhor_envio";
    serviceId?: string | null;
  } | null;
};

function isPagesWithoutBackend() {
  if (typeof window === "undefined") {
    return false;
  }

  const isLocalApi = apiBaseUrl.includes("localhost") || apiBaseUrl.includes("127.0.0.1");
  const isLocalPage = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  return isLocalApi && !isLocalPage;
}

function createRequestCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return `ORC-${suffix}`;
}

async function getSessionOrThrow(message: string) {
  if (!hasSupabaseBrowserConfig()) {
    throw new Error(message);
  }

  const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;

  if (!session) {
    throw new Error(message);
  }

  return session;
}

async function createCustomRequestDirect(payload: CustomRequestPayload) {
  const session = await getSessionOrThrow("Entre ou crie uma conta para enviar um orcamento.");

  const { data, error } = await getSupabaseBrowserClient()
    .from("custom_requests")
    .insert({
      ...payload,
      customer_email: payload.customer_email ?? session.user.email ?? null,
      code: createRequestCode(),
      user_id: session.user.id,
      status: "new"
    })
    .select("id, code, status")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { request: data } as CustomRequestResponse;
}

export async function createCustomRequest(payload: CustomRequestPayload) {
  const session = await getSessionOrThrow(
    "Entre ou crie uma conta para enviar um orcamento."
  );

  if (isPagesWithoutBackend()) {
    return createCustomRequestDirect(payload);
  }

  try {
    const response = await fetch(`${apiBaseUrl}/custom-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      throw new Error(errorPayload?.error?.message ?? "Nao foi possivel enviar o orcamento.");
    }

    return response.json() as Promise<CustomRequestResponse>;
  } catch (error) {
    if (isPagesWithoutBackend()) {
      return createCustomRequestDirect(payload);
    }

    throw error;
  }
}

export async function quoteCustomRequestShipping(code: string, postalCode: string) {
  const session = await getSessionOrThrow("Entre para calcular o frete do orcamento.");

  const response = await fetch(
    `${apiBaseUrl}/custom-requests/${encodeURIComponent(code)}/shipping-quote`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        address: {
          postalCode
        }
      })
    }
  );

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    throw new Error(errorPayload?.error?.message ?? "Nao foi possivel calcular o frete.");
  }

  return response.json() as Promise<ShippingQuoteResponse>;
}

export async function createCustomRequestCheckout(
  code: string,
  payload: CustomRequestCheckoutPayload
) {
  const session = await getSessionOrThrow("Entre para pagar o orcamento.");

  const response = await fetch(`${apiBaseUrl}/custom-requests/${encodeURIComponent(code)}/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    throw new Error(errorPayload?.error?.message ?? "Nao foi possivel iniciar o pagamento.");
  }

  return response.json() as Promise<CustomRequestCheckoutResponse>;
}
