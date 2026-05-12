import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./base-url";

const apiBaseUrl = getApiBaseUrl();

export type CheckoutOrderPayload = {
  customer: {
    name: string;
    email: string;
    phone?: string | null;
  };
  delivery: {
    method: "retirada" | "melhor_envio" | "entrega_combinar";
    address?: {
      line1?: string | null;
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
  notes?: string | null;
  couponCode?: string | null;
  items: Array<{
    productSlug: string;
    quantity: number;
    notes?: string | null;
  }>;
};

export type CheckoutOrderResponse = {
  order: {
    id: string;
    code: string;
    status: string;
    paymentStatus: string;
    totalCents: number;
    discountCents: number;
    shippingCents: number;
    deliveryMethod: string | null;
  };
  payment?: {
    provider: "mercado_pago";
    preferenceId: string;
    checkoutUrl: string | null;
    sandboxCheckoutUrl: string | null;
  };
};

export async function createCheckoutOrder(payload: CheckoutOrderPayload) {
  let response: Response;

  if (!hasSupabaseBrowserConfig()) {
    throw new Error("O login precisa estar configurado para criar pedidos vinculados à conta.");
  }

  const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;

  if (!session) {
    throw new Error("Entre ou crie uma conta para finalizar o pedido.");
  }

  try {
    response = await fetch(`${apiBaseUrl}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    const isLocalApi =
      apiBaseUrl.includes("localhost") || apiBaseUrl.includes("127.0.0.1");
    const isLocalPage =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

    if (isLocalApi && !isLocalPage) {
      throw new Error(
        "O checkout já está pronto, mas precisa do backend publicado para criar pedidos fora do ambiente local."
      );
    }

    throw error;
  }

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    throw new Error(errorPayload?.error?.message ?? "Não foi possível criar o pedido.");
  }

  return response.json() as Promise<CheckoutOrderResponse>;
}

export async function syncMercadoPagoPayment(orderCode: string, paymentId: string) {
  if (!hasSupabaseBrowserConfig()) {
    throw new Error("O login precisa estar configurado para atualizar o pedido.");
  }

  const session = (await getSupabaseBrowserClient().auth.getSession()).data.session;

  if (!session) {
    throw new Error("Entre para atualizar o pagamento do pedido.");
  }

  const response = await fetch(
    `${apiBaseUrl}/orders/${encodeURIComponent(orderCode)}/payment-sync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ paymentId })
    }
  );

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    throw new Error(errorPayload?.error?.message ?? "Nao foi possivel atualizar o pagamento.");
  }

  return response.json() as Promise<{
    order: {
      id: string;
      code: string;
      status: string;
      paymentStatus: string;
      totalCents: number;
    };
  }>;
}
