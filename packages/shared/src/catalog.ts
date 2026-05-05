import type { ProductStatus } from "./status.js";

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
};

export type ProductImage = {
  src: string;
  alt: string;
  sortOrder: number;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  priceInCents: number;
  categorySlug: string;
  categoryName?: string;
  status: ProductStatus;
  acceptsCustomization: boolean;
  productionTime: string;
  image: ProductImage;
};

export type ProductDetails = ProductSummary & {
  description: string;
  material: string;
  dimensions: string;
  weightInGrams: number;
  colors: string[];
  images: ProductImage[];
  faq: Array<{
    question: string;
    answer: string;
  }>;
  relatedSlugs: string[];
};
