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
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().optional(),
  EMAIL_NOTIFICATIONS_ENABLED: z.string().default("true"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(587)
  ),
  SMTP_SECURE: z.string().default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional().or(z.literal("")),
  SMTP_FROM_NAME: z.string().default("LM-3D"),
  SMTP_REPLY_TO: z.string().email().optional().or(z.literal("")),
  MELHOR_ENVIO_BASE_URL: z
    .string()
    .url()
    .default("https://sandbox.melhorenvio.com.br"),
  MELHOR_ENVIO_ACCESS_TOKEN: z.string().optional(),
  MELHOR_ENVIO_ALLOWED_SERVICES: z.string().optional(),
  MELHOR_ENVIO_USER_AGENT: z
    .string()
    .default("LM-3D (contato@lm-3d.com.br)"),
  MELHOR_ENVIO_SENDER_NAME: z.string().optional(),
  MELHOR_ENVIO_SENDER_PHONE: z.string().optional(),
  MELHOR_ENVIO_SENDER_EMAIL: z.string().email().optional().or(z.literal("")),
  MELHOR_ENVIO_SENDER_DOCUMENT: z.string().optional(),
  MELHOR_ENVIO_SENDER_COMPANY_DOCUMENT: z.string().optional(),
  MELHOR_ENVIO_SENDER_STATE_REGISTER: z.string().optional(),
  MELHOR_ENVIO_SENDER_ADDRESS: z.string().optional(),
  MELHOR_ENVIO_SENDER_NUMBER: z.string().optional(),
  MELHOR_ENVIO_SENDER_COMPLEMENT: z.string().optional(),
  MELHOR_ENVIO_SENDER_DISTRICT: z.string().optional(),
  MELHOR_ENVIO_SENDER_CITY: z.string().optional(),
  MELHOR_ENVIO_SENDER_STATE: z.string().optional(),
  MELHOR_ENVIO_POSTING_AGENCY_ID: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().optional()
  ),
  MELHOR_ENVIO_TRACKING_SYNC_ENABLED: z.string().default("true"),
  MELHOR_ENVIO_TRACKING_SYNC_INTERVAL_MINUTES: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(300)
  ),
  MELHOR_ENVIO_TRACKING_SYNC_BATCH_SIZE: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(30)
  ),
  STORE_ORIGIN_POSTAL_CODE: z.string().optional()
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
