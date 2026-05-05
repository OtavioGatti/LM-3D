import { Plus } from "lucide-react";
import { AdminCategoryManager } from "@/components/admin/admin-category-manager";

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

      <AdminCategoryManager />
    </div>
  );
}
