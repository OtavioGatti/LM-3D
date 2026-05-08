import Link from "next/link";
import { ArrowRight, BadgeCheck, Boxes, CreditCard, MessageCircle } from "lucide-react";
import { HomeCatalogSections } from "@/components/home/home-catalog-sections";
import { TrustRail } from "@/components/trust-rail";
import { assetPath } from "@/lib/assets";
import { getPublicCatalog } from "@/lib/catalog/public-catalog";

const trustItems = [
  {
    icon: BadgeCheck,
    title: "Produção cuidadosa",
    text: "Cada peça é revisada antes da entrega."
  },
  {
    icon: Boxes,
    title: "Materiais selecionados",
    text: "Filamentos adequados para uso decorativo e funcional."
  },
  {
    icon: MessageCircle,
    title: "Atendimento direto",
    text: "Lucas acompanha pedidos personalizados de perto."
  },
  {
    icon: CreditCard,
    title: "Pagamento seguro",
    text: "Checkout dedicado via Mercado Pago nas próximas fases."
  }
];

export default async function HomePage() {
  const { categories, featuredProducts } = await getPublicCatalog();

  return (
    <div>
      <section className="hero-section">
        <div className="page-container hero-grid">
          <div className="hero-copy">
            <h1>Impressões 3D sob medida e produtos criativos feitos com qualidade.</h1>
            <p>
              A LM-3D transforma ideias em peças prontas para presentear, organizar, decorar
              ou resolver pequenas necessidades do dia a dia.
            </p>
            <div className="hero-actions">
              <Link href="/catalogo" className="button button-primary">
                Ver catálogo
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link href="/pedido-personalizado" className="button button-secondary">
                Pedir orçamento
              </Link>
            </div>
            <TrustRail />
          </div>

          <div className="hero-media" aria-label="Produtos impressos em 3D">
            <img src={assetPath("/images/hero-print-lab.svg")} alt="" />
          </div>
        </div>
      </section>

      <HomeCatalogSections categories={categories} featuredProducts={featuredProducts} />

      <section className="section">
        <div className="page-container trust-grid">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <article className="trust-card" key={item.title}>
                <Icon aria-hidden="true" size={24} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
