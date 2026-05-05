"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { addCartItem } from "@/lib/cart/cart-storage";

export function AddToCartButton({ productSlug }: { productSlug: string }) {
  const [message, setMessage] = useState("");

  function handleAddToCart() {
    addCartItem(productSlug, 1);
    setMessage("Adicionado ao carrinho.");
    window.setTimeout(() => setMessage(""), 2200);
  }

  return (
    <div className="add-cart-action">
      <button className="button button-primary" type="button" onClick={handleAddToCart}>
        Adicionar ao carrinho
        <ArrowRight aria-hidden="true" size={18} />
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}
