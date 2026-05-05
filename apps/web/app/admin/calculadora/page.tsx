import { Calculator } from "lucide-react";

export default function AdminCalculatorPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Calculadora de preco</h1>
          <p>Estrutura da calculadora interna. A formula completa sera implementada na Fase 9.</p>
        </div>
      </div>

      <section className="admin-panel split-panel">
        <form className="admin-form">
          <div className="form-grid">
            <label>
              Valor do kg do filamento
              <input placeholder="R$ 80,00" />
            </label>
            <label>
              Peso da impressao
              <input placeholder="120 g" />
            </label>
            <label>
              Valor do kWh
              <input placeholder="R$ 0,95" />
            </label>
            <label>
              Horas de impressao
              <input placeholder="5" />
            </label>
            <label>
              Margem desejada
              <input placeholder="35%" />
            </label>
            <label>
              Taxa Mercado Pago
              <input placeholder="4,99%" />
            </label>
          </div>
        </form>

        <aside className="calculator-result">
          <Calculator aria-hidden="true" size={26} />
          <h2>Preco sugerido</h2>
          <strong>R$ 0,00</strong>
          <p>
            A margem de lucro sera calculada sobre o preco final, diferente de markup.
            Presets de filamento, energia e margem entram junto com a persistencia.
          </p>
          <button className="button button-secondary" type="button">
            Aplicar ao produto
          </button>
        </aside>
      </section>
    </div>
  );
}
