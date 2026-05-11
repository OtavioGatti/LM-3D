"use client";

import { formatBrazilianPhone, formatMoneyBRL, type ProductDetails } from "@lm-3d/shared";
import { ArrowRight, Clock, LockKeyhole, MessageSquareText, ShieldCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createCheckoutOrder } from "@/lib/api/orders";
import {
  clearCartItems,
  readCartItems,
  type StoredCartItem
} from "@/lib/cart/cart-storage";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

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
  couponCode: string;
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
  notes: "",
  couponCode: ""
};

type CouponPreview = {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_cents: number;
  max_redemptions: number | null;
  redeemed_count: number;
};

type CheckoutAuthStatus = "checking" | "signed-in" | "signed-out" | "unconfigured";

export function CheckoutManager({ products }: CheckoutManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState<StoredCartItem[]>([]);
  const [form, setForm] = useState<CheckoutFormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [authStatus, setAuthStatus] = useState<CheckoutAuthStatus>("checking");
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
  const couponDiscount = coupon
    ? Math.min(
        coupon.discount_type === "percent"
          ? Math.floor((subtotal * coupon.discount_value) / 100)
          : coupon.discount_value,
        subtotal
      )
    : 0;
  const estimatedTotal = subtotal - couponDiscount;

  useEffect(() => {
    setItems(readCartItems());
  }, []);

  useEffect(() => {
    async function loadSession() {
      if (!hasSupabaseBrowserConfig()) {
        setAuthStatus("unconfigured");
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        setAuthStatus("signed-out");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      setForm((current) => ({
        ...current,
        name:
          current.name ||
          profile?.full_name ||
          (typeof session.user.user_metadata.full_name === "string"
            ? session.user.user_metadata.full_name
            : ""),
        email: current.email || session.user.email || ""
      }));
      setAuthStatus("signed-in");
    }

    void loadSession().catch(() => {
      setAuthStatus("signed-out");
    });
  }, []);

  async function applyCoupon() {
    const code = form.couponCode.trim().toUpperCase();
    setCoupon(null);
    setCouponMessage("");

    if (!code) {
      return;
    }

    if (!hasSupabaseBrowserConfig()) {
      setCouponMessage("Cupom será validado ao criar o pedido.");
      return;
    }

    const { data, error } = await getSupabaseBrowserClient()
      .from("discount_coupons")
      .select("code, discount_type, discount_value, min_order_cents, max_redemptions, redeemed_count")
      .eq("code", code)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      setCouponMessage("Cupom não encontrado ou inativo.");
      return;
    }

    const preview = data as CouponPreview;

    if (preview.max_redemptions !== null && preview.redeemed_count >= preview.max_redemptions) {
      setCouponMessage("Este cupom atingiu o limite de uso.");
      return;
    }

    if (subtotal < preview.min_order_cents) {
      setCouponMessage(`Pedido mínimo para este cupom: ${formatMoneyBRL(preview.min_order_cents)}.`);
      return;
    }

    setCoupon(preview);
    setCouponMessage("Cupom aplicado.");
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      if (cartLines.length === 0) {
        throw new Error("Seu carrinho está vazio.");
      }

      if (authStatus !== "signed-in") {
        throw new Error("Entre ou crie uma conta para finalizar o pedido.");
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
        couponCode: form.couponCode || null,
        items: cartLines.map(({ item }) => ({
          productSlug: item.productSlug,
          quantity: item.quantity,
          notes: item.notes || null
        }))
      });

      clearCartItems();

      if (response.payment?.checkoutUrl) {
        window.location.assign(response.payment.checkoutUrl);
        return;
      }

      router.push(
        `/pedido-confirmado?code=${encodeURIComponent(response.order.code)}&payment=${encodeURIComponent(
          response.order.paymentStatus
        )}`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o pedido agora."
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
            Ver catálogo
          </Link>
        </div>
      </section>
    );
  }

  if (authStatus === "checking") {
    return (
      <section className="section">
        <div className="page-container checkout-placeholder">
          <LockKeyhole aria-hidden="true" size={36} />
          <h1>Verificando sua conta</h1>
          <p>Estamos conferindo se você já está logado para vincular o pedido à sua conta.</p>
        </div>
      </section>
    );
  }

  if (authStatus !== "signed-in") {
    return (
      <section className="section">
        <div className="page-container checkout-placeholder">
          {authStatus === "unconfigured" ? (
            <>
              <LockKeyhole aria-hidden="true" size={36} />
              <h1>Login indisponível</h1>
              <p>Configure o Supabase público no ambiente para permitir pedidos vinculados a contas.</p>
            </>
          ) : (
            <>
              <UserPlus aria-hidden="true" size={36} />
              <h1>Entre para finalizar</h1>
              <p>
                Para o pedido aparecer em Minha conta e ficar vinculado ao cliente correto, é
                necessário entrar ou criar uma conta antes de finalizar.
              </p>
              <div className="checkout-auth-actions">
                <Link href="/login?redirect=/checkout" className="button button-primary">
                  Entrar
                </Link>
                <Link href="/login?redirect=/checkout&mode=signup" className="button button-secondary">
                  Criar conta
                </Link>
              </div>
            </>
          )}
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
              Revisamos os dados, vinculamos o pedido a sua conta e seguimos para o pagamento
              seguro via Mercado Pago.
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
              inputMode="tel"
              onChange={(event) => setForm({ ...form, phone: formatBrazilianPhone(event.target.value) })}
              placeholder="(11) 99999-9999"
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
                Endereço
                <input
                  autoComplete="street-address"
                  onChange={(event) => setForm({ ...form, addressLine: event.target.value })}
                  placeholder="Rua, número, bairro"
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
            Observações gerais
            <textarea
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Prazo desejado, presente, cor preferida ou qualquer detalhe importante."
              rows={4}
              value={form.notes}
            />
          </label>

          <div className="coupon-box">
            <label>
              Cupom de desconto
              <input
                onChange={(event) => setForm({ ...form, couponCode: event.target.value })}
                placeholder="Ex.: LM10"
                value={form.couponCode}
              />
            </label>
            <button className="button button-secondary" type="button" onClick={() => void applyCoupon()}>
              Aplicar cupom
            </button>
            {couponMessage ? <p className="form-note">{couponMessage}</p> : null}
          </div>

          <div className="checkout-assurance">
            <span>
              <ShieldCheck aria-hidden="true" size={18} /> Preços recalculados no backend
            </span>
            <span>
              <MessageSquareText aria-hidden="true" size={18} /> Confirmação antes da produção
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
          {couponDiscount > 0 ? (
            <div className="summary-line">
              <span>Cupom {coupon?.code ?? form.couponCode}</span>
              <strong>-{formatMoneyBRL(couponDiscount)}</strong>
            </div>
          ) : null}
          <div className="summary-line">
            <span>Entrega</span>
            <strong>A combinar</strong>
          </div>
          <div className="summary-total">
            <span>Total estimado</span>
            <strong>{formatMoneyBRL(estimatedTotal)}</strong>
          </div>
          <div className="summary-note">
            <Clock aria-hidden="true" size={18} />
            O Mercado Pago abre em uma página segura para concluir o pagamento.
          </div>
        </aside>
      </div>
    </section>
  );
}
