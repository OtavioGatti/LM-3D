import { MessageCircle, UploadCloud } from "lucide-react";

export const metadata = {
  title: "Pedido personalizado"
};

export default function CustomOrderPage() {
  return (
    <section className="section">
      <div className="page-container custom-order-layout">
        <div>
          <h1>Pedido personalizado</h1>
          <p className="page-intro">
            Um caminho claro para clientes que querem uma peca fora do catalogo: nome,
            cor, tamanho, referencia, uso esperado ou arquivo 3D.
          </p>
          <div className="custom-order-benefits">
            <span>
              <MessageCircle aria-hidden="true" size={18} /> Lucas revisa a ideia antes de produzir.
            </span>
            <span>
              <UploadCloud aria-hidden="true" size={18} /> Upload de referencia entra nas proximas fases.
            </span>
          </div>
        </div>

        <form className="lead-form">
          <label>
            Nome
            <input placeholder="Seu nome" />
          </label>
          <label>
            WhatsApp ou e-mail
            <input placeholder="Como Lucas pode falar com voce" />
          </label>
          <label>
            O que voce quer imprimir?
            <textarea rows={6} placeholder="Descreva tamanho, cor, quantidade e finalidade." />
          </label>
          <button type="button" className="button button-primary">
            Enviar ideia
          </button>
          <p>
            Na fase de backend, este formulario sera conectado a uma fila segura de orcamentos.
          </p>
        </form>
      </div>
    </section>
  );
}
