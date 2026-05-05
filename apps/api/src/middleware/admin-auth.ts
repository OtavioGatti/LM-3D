import { ADMIN_ROLES } from "@lm-3d/shared";
import type { RequestHandler } from "express";
import { HttpError } from "../lib/http.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";

export type AdminProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "admin" | "owner";
};

function getBearerToken(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const token = getBearerToken(req.header("authorization"));

    if (!token) {
      throw new HttpError(401, "AUTH_REQUIRED", "Login administrativo obrigatorio.");
    }

    const supabase = getSupabaseAdminClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new HttpError(401, "INVALID_SESSION", "Sessao invalida ou expirada.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, phone, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !ADMIN_ROLES.includes(profile.role)) {
      throw new HttpError(403, "ADMIN_FORBIDDEN", "Acesso restrito ao Lucas/admin.");
    }

    res.locals.adminProfile = profile satisfies AdminProfile;
    next();
  } catch (error) {
    next(error);
  }
};
