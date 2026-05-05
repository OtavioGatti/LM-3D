import { Search, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";
import { categories, products } from "@/data/demo-catalog";

export const metadata = {
  title: "Catalogo"
};

export default function CatalogPage() {
  return (
    <section className="section">
      <div className="page-container">
        <SectionHeader
          title="Catalogo LM-3D"
          description="Produtos demonstrativos para validar a vitrine. Na fase do Supabase, filtros e busca passam a usar dados reais."
        />

        <div className="catalog-toolbar" aria-label="Filtros do catalogo">
          <label className="search-field">
            <Search aria-hidden="true" size={18} />
            <input type="search" placeholder="Buscar por nome, presente, escritorio..." />
          </label>
          <label>
            <span>Categoria</span>
            <select defaultValue="todos">
              <option value="todos">Todas</option>
              {categories.map((category) => (
                <option value={category.slug} key={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Disponibilidade</span>
            <select defaultValue="todos">
              <option value="todos">Todos</option>
              <option value="active">Pronta entrega</option>
              <option value="made_to_order">Sob encomenda</option>
            </select>
          </label>
          <button className="icon-button" aria-label="Ajustar filtros">
            <SlidersHorizontal aria-hidden="true" size={20} />
          </button>
        </div>

        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
