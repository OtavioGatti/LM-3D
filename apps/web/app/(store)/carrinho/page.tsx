import { CartManager } from "@/components/cart/cart-manager";
import { getPublicProducts } from "@/lib/catalog/public-catalog";

export const metadata = {
  title: "Carrinho"
};

export default async function CartPage() {
  const products = await getPublicProducts();

  return <CartManager products={products} />;
}
