"use client";

import { formatMoneyBRL, type ProductDetails } from "@lm-3d/shared";
import { ArrowRight, Clock, LockKeyhole, MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createCheckoutOrder } from "@/lib/api/orders";
import {
  clearCartItems,
  readCartItems,
  type StoredCartItem
} from "@/lib/cart/cart-storage";

type CheckoutManagerProps = {
  products: ProductDetails[];
};

type CheckoutFormState = {
  name: string;
  email: string;
  phone: string;
  deliveryMethod: "entrega_combinar" | "retirada";
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
};

const emptyForm: CheckoutFormState = {
  name: "",
  email: "",
  phone: "",
  deliveryMethod: "entrega_combinar",
  addressLine: "",
  city: "",
  state: "",
  postalCode: "",
  notes: ""
};

export function CheckoutManager({ products }: CheckoutManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState<StoredCartItem[]>([]);
  const [form, setForm] = useState<CheckoutFormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products]
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
    setItems(readCartItems());
  }, []);

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      if (cartLines.length === 0) {
        throw new Error("Seu carrinho esta vazio.");
      }

      const response = await createCheckoutOrder({
        customer: {
          name: form.name,
          email: form.email,
          phone: form.phone || null
        },
        delivery: {
          method: form.deliveryMethod,
          address:
            form.deliveryMethod === "entrega_combinar"
              ? {
                  line1: form.addressLine || null,
                  city: form.city || null,
                  state: form.state || null,
                  postalCode: form.postalCode || null
                }
              : null
        },
        notes: form.notes || null,
        items: cartLines.map(({ item }) => ({
          productSlug: item.productSlug,
          quantity: item.quantity,
          notes: item.notes || null
        }))
      });

      clearCartItems();
      router.push(
        `/pedido-confirmado?code=${encodeURIComponent(response.order.code)}&payment=${encodeURIComponent(
          response.order.paymentStatus
        )}`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel criar o pedido agora."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (cartLines.length === 0) {
    return (
      <section className="section">
        <div className="page-container checkout-placeholder">
          <LockKeyhole aria-hidden="true" size={36} />
          <h1>Nenhum item no checkout</h1>
          <p>Adicione um produto ao carrinho para criar um pedido.</p>
          <Link href="/catalogo" className="button button-primary">
            Ver catalogo
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="page-container checkout-layout">
        <form className="lead-form checkout-form" onSubmit={submitOrder}>
          <LockKeyhole aria-hidden="true" size={30} />
          <div>
            <h1>Finalizar pedido</h1>
            <p>
              Lucas recebe os dados do pedido, confirma detalhes de personalizacao e libera o
              pagamento quando o Mercado Pago estiver conectado.
            </p>
          </div>

          {message ? <p className="form-error">{message}</p> : null}

          <div className="form-grid">
            <label>
              Nome completo
              <input
                autoComplete="name"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
            <label>
              E-mail
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
                type="email"
                value={form.email}
              />
            </label>
          </div>

          <label>
            WhatsApp ou telefone
            <input
              autoComplete="tel"
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="Para confirmar personalizacoes"
              value={form.phone}
            />
          </label>

          <label>
            Forma de entrega
            <select
              onChange={(event) =>
                setForm({
                  ...form,
                  deliveryMethod: event.target.value as CheckoutFormState["deliveryMethod"]
                })
              }
              value={form.deliveryMethod}
            >
              <option value="entrega_combinar">Entrega a combinar</option>
              <option value="retirada">Retirada com Lucas</option>
            </select>
          </label>

          {form.deliveryMethod === "entrega_combinar" ? (
            <div className="form-grid">
              <label>
                Endereco
                <input
                  autoComplete="street-address"
                  onChange={(event) => setForm({ ...form, addressLine: event.target.value })}
                  placeholder="Rua, numero, bairro"
                  value={form.addressLine}
                />
              </label>
              <label>
                Cidade
                <input
                  autoComplete="address-level2"
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                  value={form.city}
                />
              </label>
              <label>
                Estado
                <input
                  autoComplete="address-level1"
                  onChange={(event) => setForm({ ...form, state: event.target.value })}
                  value={form.state}
                />
              </label>
              <label>
                CEP
                <input
                  autoComplete="postal-code"
                  onChange={(event) => setForm({ ...form, postalCode: event.target.value })}
                  value={form.postalCode}
                />
              </label>
            </div>
          ) : null}

          <label>
            Observacoes gerais
            <textarea
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Prazo desejado, presente, cor preferida ou qualquer detalhe importante."
              rows={4}
              value={form.notes}
            />
          </label>

          <div className="checkout-assurance">
            <span>
              <ShieldCheck aria-hidden="true" size={18} /> Precos recalculados no backend
            </span>
            <span>
              <MessageSquareText aria-hidden="true" size={18} /> Confirmacao antes da producao
            </span>
          </div>

          <button className="button button-primary full-width" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Criando pedido..." : "Criar pedido"}
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>

        <aside className="order-summary">
          <h2>Resumo seguro</h2>
          {cartLines.map(({ item, product }) => (
            <div className="checkout-summary-item" key={product.slug}>
              <div>
                <strong>{product.name}</strong>
                <span>
                  {item.quantity} x {formatMoneyBRL(product.priceInCents)}
                </span>
                {item.notes ? <small>{item.notes}</small> : null}
              </div>
              <strong>{formatMoneyBRL(product.priceInCents * item.quantity)}</strong>
            </div>
          ))}
          <div className="summary-line">
            <span>Subtotal</span>
            <strong>{formatMoneyBRL(subtotal)}</strong>
          </div>
          <div className="summary-line">
            <span>Entrega</span>
            <strong>A combinar</strong>
          </div>
          <div className="summary-total">
            <span>Total estimado</span>
            <strong>{formatMoneyBRL(subtotal)}</strong>
          </div>
          <div className="summary-note">
            <Clock aria-hidden="true" size={18} />
            O pagamento fica pendente ate conectarmos o Mercado Pago na etapa final.
          </div>
        </aside>
      </div>
    </section>
  );
}
