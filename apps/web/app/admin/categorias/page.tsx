import { AdminCategoryManager } from "@/components/admin/admin-category-manager";

export default function AdminCategoriesPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Categorias</h1>
          <p>Organize catálogos, grupos e ordem de exibição da vitrine.</p>
        </div>
      </div>

      <AdminCategoryManager />
    </div>
  );
}
