import { Archive, Plus, ToggleRight } from "lucide-react";

export default function AdminProductsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Produtos</h1>
          <p>Base para criar, editar, arquivar e controlar disponibilidade.</p>
        </div>
        <button className="button button-primary" type="button">
          <Plus aria-hidden="true" size={18} />
          Novo produto
        </button>
      </div>

      <section className="admin-panel split-panel">
        <div>
          <h2>Cadastro</h2>
          <form className="admin-form">
            <label>
              Nome do produto
              <input placeholder="Ex.: Chaveiro personalizado" />
            </label>
            <label>
              Descricao
              <textarea rows={4} placeholder="Explique uso, acabamento e personalizacao." />
            </label>
            <div className="form-grid">
              <label>
                Preco
                <input placeholder="R$ 0,00" />
              </label>
              <label>
                Prazo
                <input placeholder="Ex.: 3 a 5 dias uteis" />
              </label>
            </div>
          </form>
        </div>
        <div className="admin-action-list">
          <h2>Controles previstos</h2>
          <span>
            <ToggleRight aria-hidden="true" size={18} /> Ativar ou desativar produto
          </span>
          <span>
            <Archive aria-hidden="true" size={18} /> Arquivar sem apagar historico
          </span>
          <span>Imagens, estoque, peso, material, cores e dimensoes entram no CRUD completo.</span>
        </div>
      </section>
    </div>
  );
}
