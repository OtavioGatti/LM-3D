import { AdminOrderManager } from "@/components/admin/admin-order-manager";

export default function AdminOrdersPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Pedidos</h1>
          <p>Fila administrativa para acompanhar pagamento, producao e entrega.</p>
        </div>
      </div>

      <AdminOrderManager />
    </div>
  );
}
