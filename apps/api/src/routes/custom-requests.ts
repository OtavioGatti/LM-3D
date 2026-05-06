import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { getSupabaseAdminClient } from "../lib/supabase.js";

const customRequestSchema = z.object({
  customer_name: z.string().trim().min(2).max(120),
  customer_contact: z.string().trim().min(3).max(180),
  customer_email: z.string().trim().email().max(180).optional().nullable(),
  customer_phone: z.string().trim().max(40).optional().nullable(),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(2000),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  desired_material: z.string().trim().max(80).optional().nullable(),
  desired_colors: z.string().trim().max(160).optional().nullable(),
  deadline: z.string().trim().max(120).optional().nullable(),
  reference_url: z.string().trim().url().max(500).optional().nullable()
});

export const customRequestsRouter = Router();

function getBearerToken(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

function createRequestCode() {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  return `ORC-${suffix}`;
}

customRequestsRouter.post("/", async (req, res, next) => {
  try {
    const payload = customRequestSchema.parse(req.body);
    const supabase = getSupabaseAdminClient();
    const token = getBearerToken(req.header("authorization"));
    const {
      data: { user }
    } = token ? await supabase.auth.getUser(token) : { data: { user: null } };

    const { data, error } = await supabase
      .from("custom_requests")
      .insert({
        ...payload,
        code: createRequestCode(),
        user_id: user?.id ?? null,
        status: "new"
      })
      .select("id, code, status")
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ request: data });
  } catch (error) {
    next(error);
  }
});
