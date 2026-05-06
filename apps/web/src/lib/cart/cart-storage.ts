export type StoredCartItem = {
  productSlug: string;
  quantity: number;
  notes: string;
};

export const CART_STORAGE_KEY = "lm3d.cart.v1";
export const CART_UPDATED_EVENT = "lm3d-cart-updated";

function normalizeItem(item: StoredCartItem): StoredCartItem {
  return {
    productSlug: item.productSlug,
    quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1))),
    notes: item.notes ?? ""
  };
}

export function readCartItems() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredCartItem[]) : [];

    return Array.isArray(parsed)
      ? parsed.filter((item) => item.productSlug).map(normalizeItem)
      : [];
  } catch {
    return [];
  }
}

export function writeCartItems(items: StoredCartItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items.map(normalizeItem)));
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function clearCartItems() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(CART_STORAGE_KEY);
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function addCartItem(productSlug: string, quantity = 1) {
  const items = readCartItems();
  const current = items.find((item) => item.productSlug === productSlug);

  if (current) {
    current.quantity += quantity;
    writeCartItems(items);
    return;
  }

  writeCartItems([
    ...items,
    {
      productSlug,
      quantity,
      notes: ""
    }
  ]);
}

export function getCartItemCount() {
  return readCartItems().reduce((total, item) => total + item.quantity, 0);
}
