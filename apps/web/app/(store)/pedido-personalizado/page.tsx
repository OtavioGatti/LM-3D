import { MessageCircle, UploadCloud } from "lucide-react";
import { CustomOrderForm } from "@/components/custom-order/custom-order-form";

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

        <CustomOrderForm />
      </div>
    </section>
  );
}
