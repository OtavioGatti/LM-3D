import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import {
  getPublicCategories,
  getPublicProductBySlug,
  getPublicProducts,
  getPublicRelatedProducts
} from "@/lib/catalog/public-catalog";
import { formatMoneyBRL } from "@lm-3d/shared";

type ProductPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const products = await getPublicProducts();

  return products.map((product) => ({
    slug: product.slug
  }));
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);

  return {
    title: product?.name ?? "Produto"
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const categories = await getPublicCategories();
  const category = categories.find((item) => item.slug === product.categorySlug);
  const related = await getPublicRelatedProducts(product);

  return (
    <div>
      <section className="section product-detail-section">
        <div className="page-container product-detail-grid">
          <div className="product-gallery">
            {product.images.map((image) => (
              <figure className="gallery-frame" key={image.src}>
                <img src={image.src} alt={image.alt} />
              </figure>
            ))}
          </div>

          <div className="product-info-panel">
            <p className="category-label">{category?.name}</p>
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
                <dt>Dimensoes</dt>
                <dd>{product.dimensions}</dd>
              </div>
              <div>
                <dt>Cores</dt>
                <dd>{product.colors.join(", ")}</dd>
              </div>
            </dl>

            <div className="purchase-panel">
              <button className="button button-primary" type="button">
                Adicionar ao carrinho
                <ArrowRight aria-hidden="true" size={18} />
              </button>
              <Link href="/pedido-personalizado" className="button button-secondary">
                Personalizar com Lucas
              </Link>
            </div>

            <div className="cta-trust-list" aria-label="Garantias da compra">
              <span>
                <ShieldCheck aria-hidden="true" size={18} /> Pagamento seguro
              </span>
              <span>
                <Truck aria-hidden="true" size={18} /> Prazo combinado antes da producao
              </span>
              <span>
                <MessageCircle aria-hidden="true" size={18} /> Atendimento direto
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-muted">
        <div className="page-container two-column-content">
          <div>
            <h2>Perguntas frequentes</h2>
            <div className="faq-list">
              {product.faq.map((item) => (
                <article key={item.question}>
                  <h3>
                    <CheckCircle2 aria-hidden="true" size={18} />
                    {item.question}
                  </h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
          <aside className="custom-order-panel">
            <h2>Quer mudar nome, cor ou medida?</h2>
            <p>
              Produtos personalizaveis precisam de uma revisao rapida para confirmar custo,
              prazo e viabilidade da impressao.
            </p>
            <Link href="/pedido-personalizado" className="button button-secondary">
              Enviar ideia personalizada
            </Link>
          </aside>
        </div>
      </section>

      {related.length > 0 ? (
        <section className="section">
          <div className="page-container">
            <h2>Produtos relacionados</h2>
            <div className="product-grid">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
