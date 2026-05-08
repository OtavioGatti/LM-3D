"use client";

import { formatMoneyBRL, type Category, type ProductDetails } from "@lm-3d/shared";
import Link from "next/link";
import { MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { loadPublicCatalogFromBrowser } from "@/lib/catalog/public-catalog";

type LiveProductDetailProps = {
  initialProduct: ProductDetails;
  initialCategory?: Category | undefined;
};

export function LiveProductDetail({ initialProduct, initialCategory }: LiveProductDetailProps) {
  const [product, setProduct] = useState(initialProduct);
  const [category, setCategory] = useState(initialCategory);

  useEffect(() => {
    void loadPublicCatalogFromBrowser().then((catalog) => {
      if (!catalog) {
        return;
      }

      const nextProduct = catalog.products.find((item) => item.slug === initialProduct.slug);

      if (!nextProduct) {
        return;
      }

      setProduct(nextProduct);
      setCategory(catalog.categories.find((item) => item.slug === nextProduct.categorySlug));
    });
  }, [initialProduct.slug]);

  const gallery = useMemo(() => product.images, [product.images]);

  return (
    <>
      <div className="product-gallery">
        {gallery.map((image) => (
          <figure className="gallery-frame" key={image.src}>
            <img src={image.src} alt={image.alt} />
          </figure>
        ))}
      </div>

      <div className="product-info-panel">
        <p className="category-label">{category?.name ?? product.categoryName}</p>
        <h1>{product.name}</h1>
        <p className="product-lead">{product.description}</p>
        <p className="product-price">{formatMoneyBRL(product.priceInCents)}</p>

        <dl className="product-specs">
          <div>
            <dt>Prazo</dt>
            <dd>{product.productionTime}</dd>
          </div>
          <div>
            <dt>Material</dt>
            <dd>{product.material}</dd>
          </div>
          <div>
            <dt>Dimensões</dt>
            <dd>{product.dimensions}</dd>
          </div>
          <div>
            <dt>Cores</dt>
            <dd>{product.colors.join(", ")}</dd>
          </div>
        </dl>

        <div className="purchase-panel">
          <AddToCartButton productSlug={product.slug} />
          <Link href="/pedido-personalizado" className="button button-secondary">
            Personalizar com Lucas
          </Link>
        </div>

        <div className="cta-trust-list" aria-label="Garantias da compra">
          <span>
            <ShieldCheck aria-hidden="true" size={18} /> Pagamento seguro
          </span>
          <span>
            <Truck aria-hidden="true" size={18} /> Prazo combinado antes da produção
          </span>
          <span>
            <MessageCircle aria-hidden="true" size={18} /> Atendimento direto
          </span>
        </div>
      </div>
    </>
  );
}
