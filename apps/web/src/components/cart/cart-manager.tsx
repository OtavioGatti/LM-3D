"use client";

import { formatMoneyBRL, type ProductDetails } from "@lm-3d/shared";
import { ArrowRight, Clock, Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CART_UPDATED_EVENT,
  readCartItems,
  type StoredCartItem,
  writeCartItems
} from "@/lib/cart/cart-storage";
import { loadPublicCatalogFromBrowser } from "@/lib/catalog/public-catalog";
import { TextareaField } from "@/components/ui/form-field";

type CartManagerProps = {
  products: ProductDetails[];
};

function updateQuantity(items: StoredCartItem[], productSlug: string, quantity: number) {
  return items.map((item) =>
    item.productSlug === productSlug ? { ...item, quantity: Math.max(1, Math.min(99, quantity)) } : item
  );
}

export function CartManager({ products }: CartManagerProps) {
  const [items, setItems] = useState<StoredCartItem[]>([]);
  const [liveProducts, setLiveProducts] = useState(products);
  const [isCatalogRefreshing, setIsCatalogRefreshing] = useState(true);

  const productBySlug = useMemo(
    () => new Map(liveProducts.map((product) => [product.slug, product])),
    [liveProducts]
  );

  const cartLines = items
    .map((item) => {
      const product = productBySlug.get(item.productSlug);

      return product ? { item, product } : null;
    })
    .filter((line): line is { item: StoredCartItem; product: ProductDetails } => Boolean(line));

  const subtotal = cartLines.reduce(
    (total, line) => total + line.product.priceInCents * line.item.quantity,
    0
  );

  useEffect(() => {
    function syncCart() {
      setItems(readCartItems());
    }

    syncCart();
    window.addEventListener(CART_UPDATED_EVENT, syncCart);
    window.addEventListener("storage", syncCart);

    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, []);

  useEffect(() => {
    void loadPublicCatalogFromBrowser()
      .then((catalog) => {
        if (!catalog) {
          return;
        }

        setLiveProducts(catalog.products);
      })
      .finally(() => setIsCatalogRefreshing(false));
  }, []);

  function persist(nextItems: StoredCartItem[]) {
    setItems(nextItems);
    writeCartItems(nextItems);
  }

  function updateNotes(productSlug: string, notes: string) {
    persist(items.map((item) => (item.productSlug === productSlug ? { ...item, notes } : item)));
  }

  function removeItem(productSlug: string) {
    persist(items.filter((item) => item.productSlug !== productSlug));
  }

  if (items.length > 0 && cartLines.length === 0 && isCatalogRefreshing) {
    return (
      <section className="section">
        <div className="page-container empty-state cart-empty-state">
          <h1>Atualizando carrinho</h1>
          <p>Estamos conferindo os produtos mais recentes do catálogo.</p>
        </div>
      </section>
    );
  }

  if (cartLines.length === 0) {
    return (
      <section className="section">
        <div className="page-container empty-state cart-empty-state">
          <h1>Carrinho vazio</h1>
          <p>Escolha um produto do catálogo ou envie uma ideia personalizada para Lucas avaliar.</p>
          <div className="hero-actions">
            <Link href="/catalogo" className="button button-primary">
              Ver catálogo
            </Link>
            <Link href="/pedido-personalizado" className="button button-secondary">
              Pedir orçamento
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="page-container cart-layout">
        <div>
          <h1>Carrinho</h1>
          <p className="page-intro">
            Revise quantidades e deixe observações de cor, nome ou detalhe antes do checkout.
          </p>

          {cartLines.map(({ item, product }) => (
            <article className="cart-item" key={product.slug}>
              <img src={product.image.src} alt={product.image.alt} />
              <div>
                <h2>{product.name}</h2>
                <p>{product.shortDescription}</p>
                <div className="quantity-control" aria-label={`Quantidade de ${product.name}`}>
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    onClick={() => persist(updateQuantity(items, product.slug, item.quantity - 1))}
                  >
                    <Minus aria-hidden="true" size={16} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    onClick={() => persist(updateQuantity(items, product.slug, item.quantity + 1))}
                  >
                    <Plus aria-hidden="true" size={16} />
                  </button>
                </div>
                <TextareaField
                  label="Observações de personalização"
                  onChange={(event) => updateNotes(product.slug, event.target.value)}
                  placeholder="Ex.: nome, cor preferida, detalhe desejado..."
                  rows={4}
                  value={item.notes}
                />
              </div>
              <div className="cart-item-price">
                <span>{formatMoneyBRL(product.priceInCents)} cada</span>
                <strong>{formatMoneyBRL(product.priceInCents * item.quantity)}</strong>
                <button type="button" onClick={() => removeItem(product.slug)}>
                  <Trash2 aria-hidden="true" size={16} />
                  Remover
                </button>
              </div>
            </article>
          ))}
        </div>

        <aside className="order-summary">
          <h2>Resumo</h2>
          <div className="summary-line">
            <span>Itens</span>
            <strong>{cartLines.reduce((total, line) => total + line.item.quantity, 0)}</strong>
          </div>
          <div className="summary-line">
            <span>Subtotal</span>
            <strong>{formatMoneyBRL(subtotal)}</strong>
          </div>
          <div className="summary-line">
            <span>Entrega ou retirada</span>
            <strong>A combinar</strong>
          </div>
          <div className="summary-total">
            <span>Total estimado</span>
            <strong>{formatMoneyBRL(subtotal)}</strong>
          </div>
          <Link href="/checkout" className="button button-primary full-width">
            Finalizar compra
            <ArrowRight aria-hidden="true" size={18} />
          </Link>
          <div className="summary-note">
            <Clock aria-hidden="true" size={18} />
            Produtos sob encomenda podem ter prazo de produção antes do envio.
          </div>
          <div className="summary-note">
            <ShieldCheck aria-hidden="true" size={18} />
            Na próxima fase, o backend vai recalcular tudo antes de criar o pagamento.
          </div>
        </aside>
      </div>
    </section>
  );
}
