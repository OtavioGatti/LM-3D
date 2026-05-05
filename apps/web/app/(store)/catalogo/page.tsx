import { CatalogExplorer } from "@/components/catalog/catalog-explorer";
import { SectionHeader } from "@/components/section-header";
import { getPublicCatalog } from "@/lib/catalog/public-catalog";

export const metadata = {
  title: "Catalogo"
};

export default async function CatalogPage() {
  const { categories, products } = await getPublicCatalog();

  return (
    <section className="section">
      <div className="page-container">
        <SectionHeader
          title="Catalogo LM-3D"
          description="Produtos reais cadastrados no painel, com filtros por categoria, disponibilidade e personalizacao."
        />

        <CatalogExplorer categories={categories} products={products} />
      </div>
    </section>
  );
}
