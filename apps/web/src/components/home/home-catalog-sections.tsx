"use client";

import type { Category, ProductDetails } from "@lm-3d/shared";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";
import { loadPublicCatalogFromBrowser } from "@/lib/catalog/public-catalog";

type HomeCatalogSectionsProps = {
  categories: Category[];
  featuredProducts: ProductDetails[];
};

export function HomeCatalogSections({
  categories,
  featuredProducts
}: HomeCatalogSectionsProps) {
  const [liveCategories, setLiveCategories] = useState(categories);
  const [liveFeaturedProducts, setLiveFeaturedProducts] = useState(featuredProducts);

  useEffect(() => {
    void loadPublicCatalogFromBrowser().then((catalog) => {
      if (!catalog) {
        return;
      }

      setLiveCategories(catalog.categories);
      setLiveFeaturedProducts(catalog.featuredProducts);
    });
  }, []);

  return (
    <>
      <section className="section">
        <div className="page-container">
          <SectionHeader
            title="Categorias em destaque"
            description="Comece pelo tipo de peça que você procura ou envie uma ideia para personalizar."
            actionHref="/catalogo"
            actionLabel="Explorar tudo"
          />
          <div className="category-grid">
            {liveCategories.slice(0, 6).map((category) => (
              <Link href={`/catalogo?categoria=${category.slug}`} className="category-card" key={category.id}>
                <Sparkles aria-hidden="true" size={20} />
                <h3>{category.name}</h3>
                <p>{category.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="page-container">
          <SectionHeader
            title="Produtos prontos para comprar"
            description="Produtos cadastrados por Lucas, com prazo claro e possibilidade de personalização quando indicado."
            actionHref="/catalogo"
            actionLabel="Ver catálogo"
          />
          <div className="product-grid">
            {liveFeaturedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
