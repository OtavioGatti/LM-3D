"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import type { Category, ProductDetails, ProductStatus } from "@lm-3d/shared";
import { ProductCard } from "@/components/product-card";
import { useEffect, useMemo, useState } from "react";
import { loadPublicCatalogFromBrowser } from "@/lib/catalog/public-catalog";

type CatalogExplorerProps = {
  categories: Category[];
  products: ProductDetails[];
};

export function CatalogExplorer({ categories, products }: CatalogExplorerProps) {
  const [liveCategories, setLiveCategories] = useState(categories);
  const [liveProducts, setLiveProducts] = useState(products);
  const [query, setQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState("todos");
  const [status, setStatus] = useState<ProductStatus | "todos">("todos");
  const [customizable, setCustomizable] = useState("todos");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("categoria");

    if (category) {
      setCategorySlug(category);
    }
  }, []);

  useEffect(() => {
    void loadPublicCatalogFromBrowser().then((catalog) => {
      if (!catalog) {
        return;
      }

      setLiveCategories(catalog.categories);
      setLiveProducts(catalog.products);
    });
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return liveProducts.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.shortDescription, product.description, product.categoryName]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      const matchesCategory = categorySlug === "todos" || product.categorySlug === categorySlug;
      const matchesStatus = status === "todos" || product.status === status;
      const matchesCustomizable =
        customizable === "todos" ||
        (customizable === "sim" ? product.acceptsCustomization : !product.acceptsCustomization);

      return matchesQuery && matchesCategory && matchesStatus && matchesCustomizable;
    });
  }, [categorySlug, customizable, liveProducts, query, status]);

  return (
    <>
      <div className="catalog-toolbar" aria-label="Filtros do catalogo">
        <label className="search-field">
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            placeholder="Buscar por nome, presente, escritorio..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Categoria</span>
          <select value={categorySlug} onChange={(event) => setCategorySlug(event.target.value)}>
            <option value="todos">Todas</option>
            {liveCategories.map((category) => (
              <option value={category.slug} key={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Disponibilidade</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ProductStatus | "todos")}
          >
            <option value="todos">Todos</option>
            <option value="active">Pronta entrega</option>
            <option value="made_to_order">Sob encomenda</option>
          </select>
        </label>
        <label>
          <span>Personalizacao</span>
          <select value={customizable} onChange={(event) => setCustomizable(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="sim">Personalizaveis</option>
            <option value="nao">Sem personalizacao</option>
          </select>
        </label>
        <button className="icon-button" type="button" aria-label="Ajustar filtros">
          <SlidersHorizontal aria-hidden="true" size={20} />
        </button>
      </div>

      {filteredProducts.length > 0 ? (
        <div className="product-grid">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Nenhum produto encontrado</h2>
          <p>Limpe os filtros ou envie um pedido personalizado para Lucas avaliar sua ideia.</p>
        </div>
      )}
    </>
  );
}
