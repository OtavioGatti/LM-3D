import { AdminPriceCalculator } from "@/components/admin/admin-price-calculator";

export const metadata = {
  title: "Calculadora de preço"
};

export default function AdminCalculatorPage() {
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Calculadora de preço</h1>
          <p>Calcule preço de venda com margem real, custos operacionais e taxa de pagamento.</p>
        </div>
      </div>

      <AdminPriceCalculator />
    </div>
  );
}
