import { Suspense } from "react";
import { OrderConfirmationPanel } from "@/components/checkout/order-confirmation-panel";

export const metadata = {
  title: "Pedido confirmado"
};

export default function OrderConfirmedPage() {
  return (
    <section className="section">
      <Suspense fallback={null}>
        <OrderConfirmationPanel />
      </Suspense>
    </section>
  );
}
