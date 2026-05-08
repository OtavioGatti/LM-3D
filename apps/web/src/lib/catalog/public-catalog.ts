import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Category, ProductDetails, ProductImage } from "@lm-3d/shared";
import { categories as demoCategories, products as demoProducts } from "@/data/demo-catalog";
import { assetPath } from "@/lib/assets";

type PublicCategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
};

type PublicProductImageRow = {
  public_url: string | null;
  storage_path: string | null;
  alt: string | null;
  sort_order: number;
  is_primary: boolean;
};

type PublicProductCategoryRow = {
  category: PublicCategoryRow | PublicCategoryRow[] | null;
};

type PublicProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  price_cents: number;
  status: ProductDetails["status"];
  material: string | null;
  dimensions: string | null;
  weight_grams: number | null;
  production_time_days_min: number;
  production_time_days_max: number;
  accepts_customization: boolean;
  metadata: {
    color_options?: string[];
  } | null;
  product_images: PublicProductImageRow[] | null;
  product_categories: PublicProductCategoryRow[] | null;
};

let publicClient: SupabaseClient | null = null;

function hasPublicSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function getPublicSupabaseClient() {
  if (!hasPublicSupabaseConfig()) {
    return null;
  }

  publicClient ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  return publicClient;
}

export function canLoadPublicCatalogInBrowser() {
  return hasPublicSupabaseConfig();
}

function mapCategory(row: PublicCategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    sortOrder: row.sort_order
  };
}

function mapImage(row: PublicProductImageRow | undefined, productName: string): ProductImage {
  const source = row?.public_url ?? row?.storage_path;
  const src = source?.startsWith("/") ? assetPath(source) : source;

  return {
    src: src ?? assetPath("/images/product-detail.svg"),
    alt: row?.alt ?? `${productName} impresso em 3D`,
    sortOrder: row?.sort_order ?? 1
  };
}

function productionTime(min: number, max: number) {
  if (min === max) {
    return `${min} dias úteis`;
  }

  return `${min} a ${max} dias úteis`;
}

export function mapPublicProduct(row: PublicProductRow, allSlugs: string[]): ProductDetails {
  const sortedImages = [...(row.product_images ?? [])].sort((a, b) => {
    if (a.is_primary !== b.is_primary) {
      return a.is_primary ? -1 : 1;
    }

    return a.sort_order - b.sort_order;
  });
  const images = sortedImages.length
    ? sortedImages.map((image) => mapImage(image, row.name))
    : [mapImage(undefined, row.name)];
  const categoryValue = row.product_categories?.find((item) => item.category)?.category;
  const category = Array.isArray(categoryValue) ? categoryValue[0] : categoryValue;
  const primaryImage = images[0] ?? mapImage(undefined, row.name);
  const relatedSlugs = allSlugs.filter((slug) => slug !== row.slug).slice(0, 3);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    priceInCents: row.price_cents,
    categorySlug: category?.slug ?? "produtos",
    categoryName: category?.name ?? "Produto",
    status: row.status,
    acceptsCustomization: row.accepts_customization,
    productionTime: productionTime(row.production_time_days_min, row.production_time_days_max),
    material: row.material ?? "PLA",
    dimensions: row.dimensions ?? "Medidas sob consulta",
    weightInGrams: row.weight_grams ?? 0,
    colors: row.metadata?.color_options?.length ? row.metadata.color_options : ["sob consulta"],
    image: primaryImage,
    images,
    faq: [
      {
        question: "Posso personalizar esta peça?",
        answer: row.accepts_customization
          ? "Sim. Informe cor, nome ou detalhe desejado e Lucas confirma a viabilidade antes da produção."
          : "Este produto é vendido no modelo anunciado. Alterações podem ser combinadas por orçamento personalizado."
      },
      {
        question: "Quando o pedido fica pronto?",
        answer: `O prazo estimado é de ${productionTime(
          row.production_time_days_min,
          row.production_time_days_max
        )}, podendo variar conforme personalização e fila de produção.`
      }
    ],
    relatedSlugs
  };
}

export async function getPublicCategories() {
  const supabase = getPublicSupabaseClient();

  if (!supabase) {
    return demoCategories;
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name, description, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data?.length) {
    return demoCategories;
  }

  return data.map(mapCategory);
}

export async function getPublicProducts() {
  const supabase = getPublicSupabaseClient();

  if (!supabase) {
    return demoProducts;
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id,
      slug,
      name,
      short_description,
      description,
      price_cents,
      status,
      material,
      dimensions,
      weight_grams,
      production_time_days_min,
      production_time_days_max,
      accepts_customization,
      metadata,
      product_images (
        public_url,
        storage_path,
        alt,
        sort_order,
        is_primary
      ),
      product_categories (
        category:categories (
          id,
          slug,
          name,
          description,
          sort_order
        )
      )
    `
    )
    .in("status", ["active", "made_to_order"])
    .order("created_at", { ascending: false });

  if (error || !data?.length) {
    return demoProducts;
  }

  const rows = data as unknown as PublicProductRow[];
  const allSlugs = rows.map((product) => product.slug);

  return rows.map((product) => mapPublicProduct(product, allSlugs));
}

export async function getPublicCatalog() {
  const [categories, products] = await Promise.all([getPublicCategories(), getPublicProducts()]);

  return {
    categories,
    products,
    featuredProducts: products.slice(0, 3)
  };
}

export async function getPublicProductBySlug(slug: string) {
  const products = await getPublicProducts();

  return products.find((product) => product.slug === slug);
}

export async function getPublicRelatedProducts(product: ProductDetails) {
  const products = await getPublicProducts();
  const sameCategory = products.filter(
    (item) => item.slug !== product.slug && item.categorySlug === product.categorySlug
  );

  return (sameCategory.length ? sameCategory : products.filter((item) => item.slug !== product.slug)).slice(0, 3);
}

export async function loadPublicCatalogFromBrowser() {
  const supabase = getPublicSupabaseClient();

  if (!supabase) {
    return null;
  }

  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, name, description, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select(
        `
        id,
        slug,
        name,
        short_description,
        description,
        price_cents,
        status,
        material,
        dimensions,
        weight_grams,
        production_time_days_min,
        production_time_days_max,
        accepts_customization,
        metadata,
        product_images (
          public_url,
          storage_path,
          alt,
          sort_order,
          is_primary
        ),
        product_categories (
          category:categories (
            id,
            slug,
            name,
            description,
            sort_order
          )
        )
      `
      )
      .in("status", ["active", "made_to_order"])
      .order("created_at", { ascending: false })
  ]);

  if (categoriesResult.error || productsResult.error || !productsResult.data?.length) {
    return null;
  }

  const productRows = productsResult.data as unknown as PublicProductRow[];
  const slugs = productRows.map((product) => product.slug);
  const products = productRows.map((product) => mapPublicProduct(product, slugs));

  return {
    categories: categoriesResult.data.map(mapCategory),
    products,
    featuredProducts: products.slice(0, 3)
  };
}
