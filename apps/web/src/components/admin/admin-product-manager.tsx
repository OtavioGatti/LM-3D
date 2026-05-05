"use client";

import { PRODUCT_STATUSES, ProductStatus, formatMoneyBRL } from "@lm-3d/shared";
import { Archive, Plus, Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/api/admin";

type AdminCategory = {
  id: string;
  name: string;
  slug: string;
};

type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  price_cents: number;
  status: ProductStatus;
  material: string | null;
  dimensions: string | null;
  weight_grams: number | null;
  production_time_days_min: number;
  production_time_days_max: number;
  stock_quantity: number;
  accepts_customization: boolean;
  customization_prompt: string | null;
  color_options: string[];
  product_images?: Array<{ public_url: string | null; storage_path: string | null }>;
  product_categories?: Array<{ category: AdminCategory | null }>;
};

type ProductFormState = {
  id?: string;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  price: string;
  status: ProductStatus;
  material: string;
  dimensions: string;
  weight_grams: string;
  production_time_days_min: string;
  production_time_days_max: string;
  stock_quantity: string;
  accepts_customization: boolean;
  customization_prompt: string;
  color_options: string;
  category_ids: string[];
  image_urls: string;
};

const emptyForm: ProductFormState = {
  name: "",
  slug: "",
  short_description: "",
  description: "",
  price: "",
  status: "draft",
  material: "PLA",
  dimensions: "",
  weight_grams: "",
  production_time_days_min: "1",
  production_time_days_max: "3",
  stock_quantity: "0",
  accepts_customization: false,
  customization_prompt: "",
  color_options: "",
  category_ids: [],
  image_urls: ""
};

function parsePriceToCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return Math.round(Number(normalized || 0) * 100);
}

function centsToInput(value: number) {
  return (value / 100).toFixed(2).replace(".", ",");
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function AdminProductManager() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadData() {
    setIsLoading(true);
    const [productsPayload, categoriesPayload] = await Promise.all([
      adminApiFetch<{ products: AdminProduct[] }>("/admin/products"),
      adminApiFetch<{ categories: AdminCategory[] }>("/admin/categories")
    ]);
    setProducts(productsPayload.products);
    setCategories(categoriesPayload.categories);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadData().catch((error: Error) => {
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
        name: form.name,
        slug: form.slug || undefined,
        short_description: form.short_description,
        description: form.description,
        price_cents: parsePriceToCents(form.price),
        status: form.status,
        material: form.material,
        dimensions: form.dimensions || null,
        weight_grams: form.weight_grams ? Number(form.weight_grams) : null,
        production_time_days_min: Number(form.production_time_days_min),
        production_time_days_max: Number(form.production_time_days_max),
        stock_quantity: Number(form.stock_quantity),
        accepts_customization: form.accepts_customization,
        customization_prompt: form.customization_prompt || null,
        color_options: lines(form.color_options),
        category_ids: form.category_ids,
        image_urls: lines(form.image_urls)
      };

      await adminApiFetch(form.id ? `/admin/products/${form.id}` : "/admin/products", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });

      setForm(emptyForm);
      setMode("list");
      setMessage("Produto salvo.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveProduct(product: AdminProduct) {
    setMessage("");
    try {
      await adminApiFetch(`/admin/products/${product.id}`, { method: "DELETE" });
      setMessage("Produto arquivado.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel arquivar.");
    }
  }

  function editProduct(product: AdminProduct) {
    setForm({
      id: product.id,
      name: product.name,
      slug: product.slug,
      short_description: product.short_description,
      description: product.description,
      price: centsToInput(product.price_cents),
      status: product.status,
      material: product.material ?? "PLA",
      dimensions: product.dimensions ?? "",
      weight_grams: product.weight_grams ? String(product.weight_grams) : "",
      production_time_days_min: String(product.production_time_days_min),
      production_time_days_max: String(product.production_time_days_max),
      stock_quantity: String(product.stock_quantity),
      accepts_customization: product.accepts_customization,
      customization_prompt: product.customization_prompt ?? "",
      color_options: product.color_options?.join("\n") ?? "",
      category_ids:
        product.product_categories?.flatMap((item) => (item.category ? [item.category.id] : [])) ?? [],
      image_urls:
        product.product_images
          ?.map((image) => image.public_url ?? image.storage_path ?? "")
          .filter(Boolean)
          .join("\n") ?? ""
    });
    setMode("form");
  }

  function newProduct() {
    setForm(emptyForm);
    setMessage("");
    setMode("form");
  }

  function cancelForm() {
    setForm(emptyForm);
    setMessage("");
    setMode("list");
  }

  return (
    <section className="admin-panel admin-management-panel">
      <div className="admin-management-header">
        <div>
          <h2>{mode === "form" ? (form.id ? "Editar produto" : "Novo produto") : "Produtos cadastrados"}</h2>
          <p>{mode === "form" ? "Preencha os dados e salve para voltar a lista." : "Escolha um produto para editar ou crie um novo cadastro."}</p>
        </div>
        {mode === "list" ? (
          <button className="button button-primary" type="button" onClick={newProduct}>
            <Plus aria-hidden="true" size={18} />
            Novo produto
          </button>
        ) : null}
      </div>

      {message ? <p className="form-note">{message}</p> : null}

      {mode === "form" ? (
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Nome
            <input
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              value={form.name}
            />
          </label>
          <div className="form-grid">
            <label>
              Slug
              <input
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                placeholder="Gerado pelo backend"
                value={form.slug}
              />
            </label>
            <label>
              Status
              <select
                onChange={(event) => setForm({ ...form, status: event.target.value as ProductStatus })}
                value={form.status}
              >
                {PRODUCT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Resumo do card
            <input
              onChange={(event) => setForm({ ...form, short_description: event.target.value })}
              required
              value={form.short_description}
            />
          </label>
          <label>
            Descricao completa
            <textarea
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              required
              rows={4}
              value={form.description}
            />
          </label>
          <div className="form-grid">
            <label>
              Preco
              <input
                inputMode="decimal"
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                placeholder="89,90"
                required
                value={form.price}
              />
            </label>
            <label>
              Material
              <input
                onChange={(event) => setForm({ ...form, material: event.target.value })}
                value={form.material}
              />
            </label>
            <label>
              Peso em gramas
              <input
                min="0"
                onChange={(event) => setForm({ ...form, weight_grams: event.target.value })}
                type="number"
                value={form.weight_grams}
              />
            </label>
            <label>
              Estoque
              <input
                min="0"
                onChange={(event) => setForm({ ...form, stock_quantity: event.target.value })}
                type="number"
                value={form.stock_quantity}
              />
            </label>
            <label>
              Prazo minimo
              <input
                min="0"
                onChange={(event) =>
                  setForm({ ...form, production_time_days_min: event.target.value })
                }
                type="number"
                value={form.production_time_days_min}
              />
            </label>
            <label>
              Prazo maximo
              <input
                min="0"
                onChange={(event) =>
                  setForm({ ...form, production_time_days_max: event.target.value })
                }
                type="number"
                value={form.production_time_days_max}
              />
            </label>
          </div>
          <label>
            Dimensoes
            <input
              onChange={(event) => setForm({ ...form, dimensions: event.target.value })}
              value={form.dimensions}
            />
          </label>
          <label>
            Categorias
            <select
              multiple
              onChange={(event) =>
                setForm({
                  ...form,
                  category_ids: Array.from(event.target.selectedOptions).map((option) => option.value)
                })
              }
              value={form.category_ids}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            URLs de imagens
            <textarea
              onChange={(event) => setForm({ ...form, image_urls: event.target.value })}
              placeholder="Uma URL por linha"
              rows={3}
              value={form.image_urls}
            />
          </label>
          <label>
            Cores disponiveis
            <textarea
              onChange={(event) => setForm({ ...form, color_options: event.target.value })}
              placeholder="Uma cor por linha"
              rows={3}
              value={form.color_options}
            />
          </label>
          <label className="checkbox-row">
            <input
              checked={form.accepts_customization}
              onChange={(event) => setForm({ ...form, accepts_customization: event.target.checked })}
              type="checkbox"
            />
            Aceita personalizacao
          </label>
          {form.accepts_customization ? (
            <label>
              Orientacao de personalizacao
              <textarea
                onChange={(event) => setForm({ ...form, customization_prompt: event.target.value })}
                rows={3}
                value={form.customization_prompt}
              />
            </label>
          ) : null}
          <div className="admin-inline-actions">
            <button className="button button-primary" disabled={isSaving} type="submit">
              {form.id ? <Save aria-hidden="true" size={18} /> : <Plus aria-hidden="true" size={18} />}
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
            <button className="button button-secondary" type="button" onClick={cancelForm}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="admin-action-list">
        {isLoading ? <p>Carregando produtos...</p> : null}
        {products.map((product) => (
          <article className="admin-list-card" key={product.id}>
            <div>
              <strong>{product.name}</strong>
              <span>{formatMoneyBRL(product.price_cents)}</span>
              <small>{product.status}</small>
            </div>
            <div className="admin-inline-actions">
              <button type="button" onClick={() => editProduct(product)}>
                Editar
              </button>
              <button type="button" onClick={() => void archiveProduct(product)}>
                <Archive aria-hidden="true" size={16} />
                Arquivar
              </button>
            </div>
          </article>
        ))}
        {!isLoading && products.length === 0 ? (
          <div className="empty-state">
            <h2>Nenhum produto cadastrado</h2>
            <p>Crie o primeiro produto para comecar a montar a vitrine.</p>
          </div>
        ) : null}
        </div>
      )}
    </section>
  );
}
