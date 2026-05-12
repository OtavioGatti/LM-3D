import type { SupabaseAdminClient } from "./supabase.js";

export type CheckoutProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  price_cents: number;
  status: string;
  material: string | null;
  dimensions: string | null;
  weight_grams: number | null;
  package_width_cm?: number | null;
  package_height_cm?: number | null;
  package_length_cm?: number | null;
  accepts_customization: boolean;
};

export const checkoutProductBaseSelect =
  "id, slug, name, short_description, price_cents, status, material, dimensions, weight_grams, accepts_customization";

const checkoutProductShippingSelect = `${checkoutProductBaseSelect}, package_width_cm, package_height_cm, package_length_cm`;

function isMissingPackageColumn(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  return /package_(width|height|length)_cm/.test(String(error.message));
}

export async function loadCheckoutProductsBySlug(
  supabase: SupabaseAdminClient,
  slugs: string[]
) {
  const { data, error } = await supabase
    .from("products")
    .select(checkoutProductShippingSelect)
    .in("slug", slugs);

  if (!error) {
    return (data ?? []) as CheckoutProductRow[];
  }

  if (!isMissingPackageColumn(error)) {
    throw error;
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("products")
    .select(checkoutProductBaseSelect)
    .in("slug", slugs);

  if (fallbackError) {
    throw fallbackError;
  }

  return (fallbackData ?? []) as CheckoutProductRow[];
}
