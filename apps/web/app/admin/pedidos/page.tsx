import { Search } from "lucide-react";

export default function AdminOrdersPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Pedidos</h1>
          <p>Fila administrativa para acompanhar pagamento, producao e entrega.</p>
        </div>
      </div>

      <section className="admin-panel">
        <div className="catalog-toolbar compact-toolbar">
          <label className="search-field">
            <Search aria-hidden="true" size={18} />
            <input placeholder="Buscar pedido ou cliente" />
          </label>
          <label>
            <span>Status</span>
            <select defaultValue="todos">
              <option value="todos">Todos</option>
              <option value="pending_payment">Aguardando pagamento</option>
              <option value="paid">Pago</option>
              <option value="in_production">Em producao</option>
              <option value="shipped">Enviado</option>
            </select>
          </label>
        </div>

        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Pagamento</span>
            <span>Status</span>
            <span>Total</span>
          </div>
          {[
            ["LM-1004", "Marina Costa", "Pendente", "Aguardando pagamento", "R$ 89,90"],
            ["LM-1003", "Rafael Lima", "Aprovado", "Em producao", "R$ 132,00"],
            ["LM-1002", "Bianca Alves", "Aprovado", "Entregue", "R$ 54,90"]
          ].map((row) => (
            <div className="admin-table-row" key={row[0]}>
              {row.map((cell) => (
                <span key={cell}>{cell}</span>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
