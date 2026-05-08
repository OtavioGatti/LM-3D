import { AdminPriceCalculator } from "@/components/admin/admin-price-calculator";

export const metadata = {
  title: "Calculadora de preco"
};

export default function AdminCalculatorPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Calculadora de preco</h1>
          <p>Calcule preco de venda com margem real, custos operacionais e taxa de pagamento.</p>
        </div>
      </div>

      <AdminPriceCalculator />
    </div>
  );
}
