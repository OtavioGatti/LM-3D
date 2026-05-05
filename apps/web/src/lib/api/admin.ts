import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function adminApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session }
  } = await getSupabaseBrowserClient().auth.getSession();

  if (!session) {
    throw new Error("Sessao administrativa expirada.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;

    throw new Error(payload?.error?.message ?? "Nao foi possivel concluir a operacao.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
