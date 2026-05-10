import { CatalogExplorer } from "@/components/catalog/catalog-explorer";
import { SectionHeader } from "@/components/section-header";
import { assetPath } from "@/lib/assets";
import { getPublicCatalog } from "@/lib/catalog/public-catalog";

export const metadata = {
  title: "Catálogo"
};

export default async function CatalogPage() {
  const { categories, products } = await getPublicCatalog();

  return (
    <section className="section">
      <div className="page-container">
        <div className="catalog-page-hero">
          <div>
            <SectionHeader
              title="Catálogo LM-3D"
              description="Produtos reais cadastrados no painel, com filtros por categoria, disponibilidade e personalização."
            />
          </div>
          <img src={assetPath("/images/lm-3d-catalog-banner.png")} alt="" />
        </div>

        <CatalogExplorer categories={categories} products={products} />
      </div>
    </section>
  );
}
