import type { ShippingQuoteResponse } from "@lm-3d/shared";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./base-url";

const apiBaseUrl = getApiBaseUrl();

export type ShippingQuotePayload = {
  address: {
    postalCode: string;
  };
  items: Array<{
    productSlug: string;
    quantity: number;
  }>;
};

export async function quoteShippingOptions(payload: ShippingQuotePayload) {
  if (!hasSupabaseBrowserConfig()) {
    throw new Error("Entre na sua conta para calcular o frete.");
  }

  const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;

  if (!session) {
    throw new Error("Entre ou crie uma conta para calcular o frete.");
  }

  const response = await fetch(`${apiBaseUrl}/shipping/quote`, {
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

    throw new Error(errorPayload?.error?.message ?? "Não foi possível calcular o frete.");
  }

  return response.json() as Promise<ShippingQuoteResponse>;
}
