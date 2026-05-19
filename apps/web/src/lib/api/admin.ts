import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./base-url";

const apiBaseUrl = getApiBaseUrl();

function shouldUseDirectSupabase() {
  if (typeof window === "undefined") {
    return false;
  }

  const isLocalApi = apiBaseUrl.includes("localhost") || apiBaseUrl.includes("127.0.0.1");
  const isLocalPage = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  return isLocalApi && !isLocalPage;
}

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function readBody(init?: RequestInit) {
  if (!init?.body || typeof init.body !== "string") {
    return {};
  }

  return JSON.parse(init.body) as Record<string, unknown>;
}

async function directSupabaseAdminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = getSupabaseBrowserClient();
  const method = init?.method?.toUpperCase() ?? "GET";
  const body = await readBody(init);
  const categoryMatch = path.match(/^\/admin\/categories\/([^/]+)$/);
  const couponMatch = path.match(/^\/admin\/coupons\/([^/]+)$/);
  const customRequestMatch = path.match(/^\/admin\/custom-requests\/([^/]+)$/);
  const productMatch = path.match(/^\/admin\/products\/([^/]+)$/);
  const orderMatch = path.match(/^\/admin\/orders\/([^/]+)$/);

  if (path === "/admin/categories" && method === "GET") {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return { categories: data } as T;
  }

  if (path === "/admin/categories" && method === "POST") {
    const payload = { ...body, slug: toSlug(String(body.slug || body.name || "")) };
    const { data, error } = await supabase.from("categories").insert(payload).select("*").single();

    if (error) throw new Error(error.message);
    return { category: data } as T;
  }

  if (categoryMatch && method === "PATCH") {
    const payload = { ...body, ...(body.slug ? { slug: toSlug(String(body.slug)) } : {}) };
    const { data, error } = await supabase
      .from("categories")
      .update(payload)
      .eq("id", categoryMatch[1])
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { category: data } as T;
  }

  if (categoryMatch && method === "DELETE") {
    const { error } = await supabase.from("categories").delete().eq("id", categoryMatch[1]);

    if (error) throw new Error(error.message);
    return undefined as T;
  }

  if (path === "/admin/products" && method === "GET") {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        *,
        product_images (*),
        product_categories (
          category:categories (*)
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { products: data } as T;
  }

  if (path === "/admin/custom-requests" && method === "GET") {
    const { data, error } = await supabase
      .from("custom_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { requests: data } as T;
  }

  if (path === "/admin/coupons" && method === "GET") {
    const { data, error } = await supabase
      .from("discount_coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { coupons: data } as T;
  }

  if (path === "/admin/price/presets" && method === "GET") {
    const { data, error } = await supabase
      .from("price_calculation_presets")
      .select("*")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { presets: data } as T;
  }

  if (path === "/admin/price/presets" && method === "POST") {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (body.is_default) {
      await supabase
        .from("price_calculation_presets")
        .update({ is_default: false })
        .eq("owner_id", session?.user.id);
    }

    const { data, error } = await supabase
      .from("price_calculation_presets")
      .insert({ ...body, owner_id: session?.user.id })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { preset: data } as T;
  }

  if (path === "/admin/price/calculations" && method === "GET") {
    const { data, error } = await supabase
      .from("price_calculations")
      .select("*, product:products (id, name)")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw new Error(error.message);
    return { calculations: data } as T;
  }

  if (path === "/admin/price/calculations" && method === "POST") {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from("price_calculations")
      .insert({ ...body, created_by: session?.user.id })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { calculation: data } as T;
  }

  if (path === "/admin/coupons" && method === "POST") {
    const payload = { ...body, code: String(body.code ?? "").trim().toUpperCase().replace(/\s+/g, "-") };
    const { data, error } = await supabase.from("discount_coupons").insert(payload).select("*").single();

    if (error) throw new Error(error.message);
    return { coupon: data } as T;
  }

  if (couponMatch && method === "PATCH") {
    const payload = {
      ...body,
      ...(body.code ? { code: String(body.code).trim().toUpperCase().replace(/\s+/g, "-") } : {})
    };
    const { data, error } = await supabase
      .from("discount_coupons")
      .update(payload)
      .eq("id", couponMatch[1])
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { coupon: data } as T;
  }

  if (customRequestMatch && method === "PATCH") {
    const { data, error } = await supabase
      .from("custom_requests")
      .update(body)
      .eq("id", customRequestMatch[1])
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { request: data } as T;
  }

  if (path === "/admin/products" && method === "POST") {
    const { category_ids: categoryIds = [], image_urls: imageUrls = [], ...productPayload } = body as {
      category_ids?: string[];
      image_urls?: string[];
      [key: string]: unknown;
    };
    const slug = toSlug(String(productPayload.slug || productPayload.name || ""));
    const { data: product, error } = await supabase
      .from("products")
      .insert({ ...productPayload, slug })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    if (categoryIds.length > 0) {
      const { error: categoryError } = await supabase.from("product_categories").insert(
        categoryIds.map((categoryId) => ({
          product_id: product.id,
          category_id: categoryId
        }))
      );
      if (categoryError) throw new Error(categoryError.message);
    }

    if (imageUrls.length > 0) {
      const { error: imageError } = await supabase.from("product_images").insert(
        imageUrls.map((url, index) => ({
          product_id: product.id,
          public_url: url,
          alt: product.name,
          sort_order: index + 1
        }))
      );
      if (imageError) throw new Error(imageError.message);
    }

    return { product } as T;
  }

  if (productMatch && method === "PATCH") {
    const { category_ids: categoryIds, image_urls: imageUrls, ...productPayload } = body as {
      category_ids?: string[];
      image_urls?: string[];
      [key: string]: unknown;
    };
    const payload = {
      ...productPayload,
      ...(productPayload.slug ? { slug: toSlug(String(productPayload.slug)) } : {})
    };
    const { data: product, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", productMatch[1])
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    if (categoryIds) {
      await supabase.from("product_categories").delete().eq("product_id", productMatch[1]);
      if (categoryIds.length > 0) {
        const { error: categoryError } = await supabase.from("product_categories").insert(
          categoryIds.map((categoryId) => ({
            product_id: productMatch[1],
            category_id: categoryId
          }))
        );
        if (categoryError) throw new Error(categoryError.message);
      }
    }

    if (imageUrls) {
      await supabase.from("product_images").delete().eq("product_id", productMatch[1]);
      if (imageUrls.length > 0) {
        const { error: imageError } = await supabase.from("product_images").insert(
          imageUrls.map((url, index) => ({
            product_id: productMatch[1],
            public_url: url,
            alt: product.name,
            sort_order: index + 1
          }))
        );
        if (imageError) throw new Error(imageError.message);
      }
    }

    return { product } as T;
  }

  if (productMatch && method === "DELETE") {
    const { data, error } = await supabase
      .from("products")
      .update({ status: "archived" })
      .eq("id", productMatch[1])
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return { product: data } as T;
  }

  if (path === "/admin/orders" && method === "GET") {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items (*), payments (*)")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { orders: data } as T;
  }

  if (orderMatch && method === "PATCH") {
    const { data, error } = await supabase
      .from("orders")
      .update(body)
      .eq("id", orderMatch[1])
      .select("*, order_items (*), payments (*)")
      .single();

    if (error) throw new Error(error.message);
    return { order: data } as T;
  }

  throw new Error("Rota administrativa não suportada no modo GitHub Pages.");
}

export async function adminApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session }
  } = await getSupabaseBrowserClient().auth.getSession();

  if (!session) {
    throw new Error("Sessão administrativa expirada.");
  }

  if (shouldUseDirectSupabase()) {
    return directSupabaseAdminFetch<T>(path, init);
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

    throw new Error(payload?.error?.message ?? "Não foi possível concluir a operação.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
