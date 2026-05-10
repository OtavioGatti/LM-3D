import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Leaf,
  MessageCircle,
  PackageCheck,
  Printer,
  Ruler,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { HomeCatalogSections } from "@/components/home/home-catalog-sections";
import { assetPath } from "@/lib/assets";
import { getPublicCatalog } from "@/lib/catalog/public-catalog";

const processSteps = [
  {
    icon: Ruler,
    title: "1. Você envia sua ideia",
    text: "Conte o que precisa e mande referências pelo formulário."
  },
  {
    icon: ClipboardCheck,
    title: "2. Orçamento personalizado",
    text: "Lucas analisa o material, o prazo e confirma o valor."
  },
  {
    icon: Printer,
    title: "3. Produção com precisão",
    text: "Sua peça é impressa com tecnologia e cuidado."
  },
  {
    icon: Sparkles,
    title: "4. Acabamento e qualidade",
    text: "Cada detalhe é revisado antes da entrega."
  },
  {
    icon: PackageCheck,
    title: "5. Entrega combinada",
    text: "Você recebe ou retira com tudo alinhado previamente."
  }
];

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Qualidade",
    text: "Peças resistentes e bem acabadas."
  },
  {
    icon: Leaf,
    title: "Materiais",
    text: "PLA e filamentos escolhidos para cada uso."
  },
  {
    icon: BadgeCheck,
    title: "Produção ágil",
    text: "Prazo claro antes de iniciar a impressão."
  },
  {
    icon: MessageCircle,
    title: "Atendimento",
    text: "Suporte próximo para personalizações."
  }
];

export default async function HomePage() {
  const { categories, featuredProducts } = await getPublicCatalog();
  const heroImage = assetPath("/images/lm-3d-hero-premium.png");
  const heroAlt = "Produtos impressos em 3D premium sobre bancada clara";

  return (
    <div>
      <section className="home-hero">
        <div className="page-container home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-hero-kicker">Impressão 3D sob medida</p>
            <h1>
              Transformamos ideias em produtos <span>reais.</span>
            </h1>
            <p>
              Peças personalizadas com qualidade, precisão e acabamento premium para decorar,
              organizar, presentear ou resolver necessidades do dia a dia.
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
          </div>

          <div className="home-hero-media" aria-label="Produtos impressos em 3D">
            <div className="hero-photo-frame">
              <img src={heroImage} alt={heroAlt} />
            </div>
          </div>
        </div>

        <div className="page-container home-proof-row" aria-label="Diferenciais da LM-3D">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title}>
                <Icon aria-hidden="true" size={22} />
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="process-section" id="como-funciona">
        <div className="page-container">
          <div className="process-heading">
            <h2>Como funciona</h2>
          </div>
          <div className="process-grid">
            {processSteps.map((step) => {
              const Icon = step.icon;
              return (
                <article key={step.title}>
                  <span>
                    <Icon aria-hidden="true" size={24} />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <HomeCatalogSections categories={categories} featuredProducts={featuredProducts} />

      <section className="home-about-band" id="sobre">
        <div className="about-image">
          <img src={assetPath("/images/lm-3d-printer-about.png")} alt="" />
        </div>
        <div className="about-copy">
          <p>Sobre a LM-3D</p>
          <h2>
            Compromisso com <span>qualidade</span> em cada camada.
          </h2>
          <p>
            Utilizamos impressoras de alta precisão e materiais selecionados para entregar
            peças resistentes, funcionais e com acabamento cuidadoso.
          </p>
          <div className="about-metrics" aria-label="Diferenciais de produção">
            <span>
              <Boxes aria-hidden="true" size={22} />
              Peças sob medida
            </span>
            <span>
              <CheckCircle2 aria-hidden="true" size={22} />
              Revisão antes da entrega
            </span>
            <span>
              <CreditCard aria-hidden="true" size={22} />
              Pagamento seguro
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
