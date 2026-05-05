import { GripVertical, Plus } from "lucide-react";
import { categories } from "@/data/demo-catalog";

export default function AdminCategoriesPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Categorias</h1>
          <p>Organize catalogos, grupos e ordem de exibicao da vitrine.</p>
        </div>
        <button className="button button-primary" type="button">
          <Plus aria-hidden="true" size={18} />
          Nova categoria
        </button>
      </div>

      <section className="admin-panel">
        <div className="category-admin-list">
          {categories.map((category) => (
            <article key={category.id}>
              <GripVertical aria-hidden="true" size={18} />
              <div>
                <h2>{category.name}</h2>
                <p>{category.description}</p>
              </div>
              <button type="button">Editar</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
