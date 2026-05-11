import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { HttpError } from "./http.js";

let adminClient: SupabaseClient | null = null;

export type SupabaseAdminClient = SupabaseClient;

export function hasSupabaseAdminConfig() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdminClient() {
  if (!hasSupabaseAdminConfig()) {
    throw new HttpError(
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Supabase ainda nao foi configurado no backend."
    );
  }

  adminClient ??= createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return adminClient;
}
