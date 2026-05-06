import { CheckoutManager } from "@/components/checkout/checkout-manager";
import { getPublicProducts } from "@/lib/catalog/public-catalog";

export const metadata = {
  title: "Checkout"
};

export default async function CheckoutPage() {
  const products = await getPublicProducts();

  return <CheckoutManager products={products} />;
}
