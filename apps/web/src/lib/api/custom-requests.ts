import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

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

async function createCustomRequestDirect(payload: CustomRequestPayload) {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const { data, error } = await supabase
    .from("custom_requests")
    .insert({
      ...payload,
      code: createRequestCode(),
      user_id: session?.user.id ?? null,
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
  if (isPagesWithoutBackend()) {
    return createCustomRequestDirect(payload);
  }

  const session = hasSupabaseBrowserConfig()
    ? (await getSupabaseBrowserClient().auth.getSession()).data.session
    : null;

  try {
    const response = await fetch(`${apiBaseUrl}/custom-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;

      throw new Error(errorPayload?.error?.message ?? "Não foi possível enviar o orçamento.");
    }

    return response.json() as Promise<CustomRequestResponse>;
  } catch (error) {
    if (isPagesWithoutBackend()) {
      return createCustomRequestDirect(payload);
    }

    throw error;
  }
}
