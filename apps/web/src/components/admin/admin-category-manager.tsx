"use client";

import { FormEvent, useEffect, useState } from "react";
import { GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { adminApiFetch } from "@/lib/api/admin";

type AdminCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

type CategoryFormState = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  sort_order: string;
  is_active: boolean;
};

const emptyForm: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  sort_order: "0",
  is_active: true
};

export function AdminCategoryManager() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [form, setForm] = useState<CategoryFormState>(emptyForm);
  const [mode, setMode] = useState<"list" | "form">("list");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadCategories() {
    setIsLoading(true);
    const payload = await adminApiFetch<{ categories: AdminCategory[] }>("/admin/categories");
    setCategories(payload.categories);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadCategories().catch((error: Error) => {
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
        description: form.description,
        sort_order: Number(form.sort_order),
        is_active: form.is_active
      };

      await adminApiFetch(form.id ? `/admin/categories/${form.id}` : "/admin/categories", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });

      setForm(emptyForm);
      setMode("list");
      setMessage("Categoria salva.");
      await loadCategories();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(category: AdminCategory) {
    setMessage("");
    try {
      await adminApiFetch(`/admin/categories/${category.id}`, { method: "DELETE" });
      setMessage("Categoria apagada.");
      await loadCategories();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel apagar.");
    }
  }

  function newCategory() {
    setForm(emptyForm);
    setMessage("");
    setMode("form");
  }

  function editCategory(category: AdminCategory) {
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      sort_order: String(category.sort_order),
      is_active: category.is_active
    });
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
          <h2>{mode === "form" ? (form.id ? "Editar categoria" : "Nova categoria") : "Categorias cadastradas"}</h2>
          <p>{mode === "form" ? "Salve para voltar a lista de categorias." : "Escolha uma categoria para editar ou crie uma nova."}</p>
        </div>
        {mode === "list" ? (
          <button className="button button-primary" type="button" onClick={newCategory}>
            <Plus aria-hidden="true" size={18} />
            Nova categoria
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
              placeholder="Ex.: Presentes"
              required
              value={form.name}
            />
          </label>
          <label>
            Slug
            <input
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
              placeholder="Gerado pelo backend se ficar vazio"
              value={form.slug}
            />
          </label>
          <label>
            Descricao
            <textarea
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              rows={3}
              value={form.description}
            />
          </label>
          <div className="form-grid">
            <label>
              Ordem
              <input
                min="0"
                onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
                type="number"
                value={form.sort_order}
              />
            </label>
            <label className="checkbox-row">
              <input
                checked={form.is_active}
                onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                type="checkbox"
              />
              Categoria ativa
            </label>
          </div>
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
      <div className="category-admin-list">
        {isLoading ? <p>Carregando categorias...</p> : null}
        {categories.map((category) => (
          <article key={category.id}>
            <GripVertical aria-hidden="true" size={18} />
            <div>
              <h2>{category.name}</h2>
              <p>{category.description || category.slug}</p>
            </div>
            <div className="row-actions">
              <button
                type="button"
                onClick={() => editCategory(category)}
              >
                Editar
              </button>
              <button type="button" aria-label="Apagar categoria" onClick={() => void handleDelete(category)}>
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          </article>
        ))}
        {!isLoading && categories.length === 0 ? (
          <div className="empty-state">
            <h2>Nenhuma categoria cadastrada</h2>
            <p>Crie categorias para organizar a vitrine publica.</p>
          </div>
        ) : null}
      </div>
      )}
    </section>
  );
}
