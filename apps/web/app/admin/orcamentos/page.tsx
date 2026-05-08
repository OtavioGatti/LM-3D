import { AdminCustomRequestManager } from "@/components/admin/admin-custom-request-manager";

export const metadata = {
  title: "Orçamentos"
};

export default function AdminCustomRequestsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Orçamentos</h1>
          <p>Solicitações personalizadas enviadas pela vitrine pública.</p>
        </div>
      </div>

      <AdminCustomRequestManager />
    </div>
  );
}
