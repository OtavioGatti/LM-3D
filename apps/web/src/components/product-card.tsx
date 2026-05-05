import Link from "next/link";
import { ArrowRight, Palette } from "lucide-react";
import type { ProductSummary } from "@lm-3d/shared";
import { formatMoneyBRL } from "@lm-3d/shared";
import { getCategoryBySlug } from "@/data/demo-catalog";

export function ProductCard({ product }: { product: ProductSummary }) {
  const category = getCategoryBySlug(product.categorySlug);

  return (
    <article className="product-card">
      <Link href={`/produtos/${product.slug}`} className="product-image-link" aria-label={`Ver ${product.name}`}>
        <img src={product.image.src} alt={product.image.alt} />
      </Link>
      <div className="product-card-body">
        <div className="product-card-meta">
          <span>{product.categoryName ?? category?.name ?? "Produto"}</span>
          {product.acceptsCustomization ? (
            <span>
              <Palette aria-hidden="true" size={14} />
              Personalizavel
            </span>
          ) : null}
        </div>
        <h3>{product.name}</h3>
        <p>{product.shortDescription}</p>
        <div className="product-card-footer">
          <strong>{formatMoneyBRL(product.priceInCents)}</strong>
          <Link href={`/produtos/${product.slug}`} className="text-link">
            Ver detalhes
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
