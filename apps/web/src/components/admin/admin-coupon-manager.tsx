"use client";

import { formatMoneyBRL } from "@lm-3d/shared";
import { Plus, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/api/admin";
import { SelectField, TextField } from "@/components/ui/form-field";

type Coupon = {
  id: string;
  code: string;
  name: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_cents: number;
  max_redemptions: number | null;
  redeemed_count: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type CouponForm = {
  id?: string;
  code: string;
  name: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  min_order: string;
  max_redemptions: string;
  unlimited: boolean;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
};

const emptyForm: CouponForm = {
  code: "",
  name: "",
  discount_type: "percent",
  discount_value: "",
  min_order: "0",
  max_redemptions: "",
  unlimited: true,
  is_active: true,
  starts_at: "",
  ends_at: ""
};

function cents(value: string) {
  return Math.round(Number(value.replace(/\./g, "").replace(",", ".") || 0) * 100);
}

function moneyInput(value: number) {
  return (value / 100).toFixed(2).replace(".", ",");
}

function datetimeInput(value: string | null) {
  return value ? value.slice(0, 16) : "";
}

function datetimePayload(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function AdminCouponManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadCoupons() {
    setIsLoading(true);
    const payload = await adminApiFetch<{ coupons: Coupon[] }>("/admin/coupons");
    setCoupons(payload.coupons);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadCoupons().catch((error: Error) => {
      setMessage(error.message);
      setIsLoading(false);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSaving(true);

    try {
      const payload = {
        code: form.code,
        name: form.name,
        discount_type: form.discount_type,
        discount_value:
          form.discount_type === "percent" ? Number(form.discount_value) : cents(form.discount_value),
        min_order_cents: cents(form.min_order),
        max_redemptions: form.unlimited ? null : Number(form.max_redemptions || 1),
        is_active: form.is_active,
        starts_at: datetimePayload(form.starts_at),
        ends_at: datetimePayload(form.ends_at)
      };

      await adminApiFetch(form.id ? `/admin/coupons/${form.id}` : "/admin/coupons", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });

      setForm(emptyForm);
      setMode("list");
      setMessage("Cupom salvo.");
      await loadCoupons();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o cupom.");
    } finally {
      setIsSaving(false);
    }
  }

  function editCoupon(coupon: Coupon) {
    setForm({
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      discount_type: coupon.discount_type,
      discount_value:
        coupon.discount_type === "percent" ? String(coupon.discount_value) : moneyInput(coupon.discount_value),
      min_order: moneyInput(coupon.min_order_cents),
      max_redemptions: coupon.max_redemptions ? String(coupon.max_redemptions) : "",
      unlimited: coupon.max_redemptions === null,
      is_active: coupon.is_active,
      starts_at: datetimeInput(coupon.starts_at),
      ends_at: datetimeInput(coupon.ends_at)
    });
    setMode("form");
  }

  return (
    <section className="admin-panel admin-management-panel">
      <div className="admin-management-header">
        <div>
          <h2>{mode === "form" ? (form.id ? "Editar cupom" : "Novo cupom") : "Cupons cadastrados"}</h2>
          <p>Crie descontos com limite de uso ou disponibilidade ilimitada.</p>
        </div>
        {mode === "list" ? (
          <button className="button button-primary" type="button" onClick={() => setMode("form")}>
            <Plus aria-hidden="true" size={18} />
            Novo cupom
          </button>
        ) : null}
      </div>

      {message ? <p className="form-note">{message}</p> : null}

      {mode === "form" ? (
        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <TextField
              label="Código"
              onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              placeholder="LM10"
              required
              value={form.code}
            />
            <TextField
              label="Nome interno"
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Promoção de lançamento"
              required
              value={form.name}
            />
          </div>
          <div className="form-grid">
            <SelectField
              label="Tipo"
              onChange={(event) =>
                setForm({ ...form, discount_type: event.target.value as CouponForm["discount_type"] })
              }
              value={form.discount_type}
            >
              <option value="percent">Percentual</option>
              <option value="fixed">Valor fixo</option>
            </SelectField>
            <TextField
              hint={form.discount_type === "percent" ? "Informe o percentual sem %." : "Use vírgula para centavos."}
              inputMode="decimal"
              label="Desconto"
              onChange={(event) => setForm({ ...form, discount_value: event.target.value })}
              placeholder={form.discount_type === "percent" ? "10" : "15,00"}
              required
              value={form.discount_value}
            />
            <TextField
              hint="Valor mínimo do carrinho para aceitar o cupom."
              inputMode="decimal"
              label="Pedido mínimo"
              onChange={(event) => setForm({ ...form, min_order: event.target.value })}
              value={form.min_order}
            />
            <TextField
              disabled={form.unlimited}
              label="Limite de usos"
              min="1"
              onChange={(event) => setForm({ ...form, max_redemptions: event.target.value })}
              placeholder="100"
              type="number"
              value={form.max_redemptions}
            />
          </div>
          <div className="form-grid">
            <TextField
              label="Início da validade"
              onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
              type="datetime-local"
              value={form.starts_at}
            />
            <TextField
              label="Fim da validade"
              onChange={(event) => setForm({ ...form, ends_at: event.target.value })}
              type="datetime-local"
              value={form.ends_at}
            />
          </div>
          <label className="checkbox-row">
            <input
              checked={form.unlimited}
              onChange={(event) => setForm({ ...form, unlimited: event.target.checked })}
              type="checkbox"
            />
            Uso ilimitado
          </label>
          <label className="checkbox-row">
            <input
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
              type="checkbox"
            />
            Cupom ativo
          </label>
          <div className="admin-inline-actions">
            <button className="button button-primary" disabled={isSaving} type="submit">
              <Save aria-hidden="true" size={18} />
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
            <button className="button button-secondary" type="button" onClick={() => setMode("list")}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="admin-action-list">
          {isLoading ? <p>Carregando cupons...</p> : null}
          {coupons.map((coupon) => {
            const limitReached =
              coupon.max_redemptions !== null && coupon.redeemed_count >= coupon.max_redemptions;
            return (
              <article className="admin-list-card" key={coupon.id}>
                <div>
                  <strong>{coupon.code}</strong>
                  <span>{coupon.name}</span>
                  <span>
                    {coupon.discount_type === "percent"
                      ? `${coupon.discount_value}%`
                      : formatMoneyBRL(coupon.discount_value)}
                  </span>
                  <small>
                    {coupon.is_active && !limitReached ? "ativo" : "travado"} · {coupon.redeemed_count}/
                    {coupon.max_redemptions ?? "infinito"}
                  </small>
                </div>
                <button type="button" onClick={() => editCoupon(coupon)}>
                  Editar
                </button>
              </article>
            );
          })}
          {!isLoading && coupons.length === 0 ? (
            <div className="empty-state">
              <h2>Nenhum cupom cadastrado</h2>
              <p>Crie o primeiro cupom para liberar descontos no checkout.</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
