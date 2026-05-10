"use client";

import type { Category, ProductDetails } from "@lm-3d/shared";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import { assetPath } from "@/lib/assets";
import { loadPublicCatalogFromBrowser } from "@/lib/catalog/public-catalog";

type HomeCatalogSectionsProps = {
  categories: Category[];
  featuredProducts: ProductDetails[];
};

const solutionCards = [
  {
    title: "Organizadores",
    text: "Soluções práticas para manter seu espaço sempre em ordem.",
    href: "/catalogo?categoria=escritorio",
    image: "/images/lm-3d-category-organizers.png"
  },
  {
    title: "Decoração",
    text: "Peças modernas que valorizam qualquer ambiente.",
    href: "/catalogo?categoria=decoracao",
    image: "/images/lm-3d-category-decoration.png"
  },
  {
    title: "Suportes",
    text: "Funcionalidade e design para o seu dia a dia.",
    href: "/catalogo?categoria=pecas-funcionais",
    image: "/images/lm-3d-category-supports.png"
  },
  {
    title: "Acessórios",
    text: "Pequenos detalhes que fazem grande diferença.",
    href: "/catalogo",
    image: "/images/lm-3d-category-accessories.png"
  }
];

export function HomeCatalogSections({
  featuredProducts
}: HomeCatalogSectionsProps) {
  const [liveFeaturedProducts, setLiveFeaturedProducts] = useState(featuredProducts);

  useEffect(() => {
    void loadPublicCatalogFromBrowser().then((catalog) => {
      if (!catalog) {
        return;
      }

      setLiveFeaturedProducts(catalog.featuredProducts);
    });
  }, []);

  return (
    <>
      <section className="popular-section" id="materiais">
        <div className="page-container popular-layout">
          <div className="popular-copy">
            <p>Produtos populares</p>
            <h2>
              Soluções criativas para o seu dia a dia.
            </h2>
            <span>
              Organizadores, peças decorativas, acessórios, suportes e itens personalizados
              feitos para facilitar a rotina.
            </span>
            <Link href="/catalogo" className="button button-primary">
              Ver catálogo completo
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          </div>
          <div className="popular-product-row">
            {solutionCards.map((card) => (
              <Link href={card.href} className="popular-product-card" key={card.title}>
                <span className="popular-product-image">
                  <img src={assetPath(card.image)} alt="" />
                </span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section product-showcase-section">
        <div className="page-container">
          <div className="product-showcase-banner" aria-hidden="true">
            <img src={assetPath("/images/lm-3d-popular-products.png")} alt="" />
          </div>
          <div className="section-header">
            <div>
              <h2>Produtos prontos para comprar</h2>
              <p>Itens cadastrados por Lucas, com preço atualizado, prazo claro e personalização quando indicado.</p>
            </div>
            <Link href="/catalogo" className="text-link">
              Explorar tudo
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
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
