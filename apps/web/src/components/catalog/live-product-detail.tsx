"use client";

import { formatMoneyBRL, type Category, type ProductDetails } from "@lm-3d/shared";
import Link from "next/link";
import { MessageCircle, ShieldCheck, Truck, X, ZoomIn } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { loadPublicCatalogFromBrowser } from "@/lib/catalog/public-catalog";

type GalleryImage = ProductDetails["images"][number];

type LiveProductDetailProps = {
  initialProduct: ProductDetails;
  initialCategory?: Category | undefined;
};

export function LiveProductDetail({ initialProduct, initialCategory }: LiveProductDetailProps) {
  const [product, setProduct] = useState(initialProduct);
  const [category, setCategory] = useState(initialCategory);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

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

  useEffect(() => {
    if (!selectedImage) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedImage(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedImage]);

  const gallery = useMemo(() => product.images, [product.images]);

  return (
    <>
      <div className="product-gallery">
        {gallery.map((image) => (
          <figure className="gallery-frame" key={image.src}>
            <button type="button" className="gallery-image-button" onClick={() => setSelectedImage(image)}>
              <img src={image.src} alt={image.alt} />
              <span className="gallery-zoom-copy">
                <ZoomIn aria-hidden="true" size={16} />
                Ampliar foto
              </span>
            </button>
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

      {selectedImage ? (
        <div className="image-lightbox" role="dialog" aria-modal="true" aria-label={`Foto ampliada de ${product.name}`} onClick={() => setSelectedImage(null)}>
          <button type="button" className="image-lightbox-close" aria-label="Fechar foto ampliada" onClick={() => setSelectedImage(null)}>
            <X aria-hidden="true" size={22} />
          </button>
          <figure className="image-lightbox-frame" onClick={(event) => event.stopPropagation()}>
            <img src={selectedImage.src} alt={selectedImage.alt} />
            <figcaption>{selectedImage.alt}</figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}
