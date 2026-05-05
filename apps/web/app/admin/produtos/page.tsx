import { AdminProductManager } from "@/components/admin/admin-product-manager";

export default function AdminProductsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Produtos</h1>
          <p>Base para criar, editar, arquivar e controlar disponibilidade.</p>
        </div>
      </div>

      <AdminProductManager />
    </div>
  );
}
