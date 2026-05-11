import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  APP_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  MERCADO_PAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().optional()
});

export const env = envSchema.parse(process.env);

export const corsOriginRules = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

function wildcardToRegExp(rule: string) {
  const escaped = rule
    .split("*")
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"))
    .join(".*");

  return new RegExp(`^${escaped}$`);
}

export function isAllowedCorsOrigin(origin: string | undefined) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  return corsOriginRules.some((rule) => {
    const normalizedRule = normalizeOrigin(rule);

    if (normalizedRule === "*") {
      return env.NODE_ENV !== "production";
    }

    if (normalizedRule.includes("*")) {
      return wildcardToRegExp(normalizedRule).test(normalizedOrigin);
    }

    return normalizedRule === normalizedOrigin;
  });
}
