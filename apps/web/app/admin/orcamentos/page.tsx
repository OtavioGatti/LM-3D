import { AdminCustomRequestManager } from "@/components/admin/admin-custom-request-manager";

export const metadata = {
  title: "Orcamentos"
};

export default function AdminCustomRequestsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Orcamentos</h1>
          <p>Solicitacoes personalizadas enviadas pela vitrine publica.</p>
        </div>
      </div>

      <AdminCustomRequestManager />
    </div>
  );
}
