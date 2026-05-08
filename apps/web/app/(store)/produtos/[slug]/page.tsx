import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { LiveProductDetail } from "@/components/catalog/live-product-detail";
import { ProductCard } from "@/components/product-card";
import {
  getPublicCategories,
  getPublicProductBySlug,
  getPublicProducts,
  getPublicRelatedProducts
} from "@/lib/catalog/public-catalog";

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
          <LiveProductDetail initialProduct={product} initialCategory={category} />
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
              Produtos personalizáveis precisam de uma revisão rápida para confirmar custo,
              prazo e viabilidade da impressão.
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
