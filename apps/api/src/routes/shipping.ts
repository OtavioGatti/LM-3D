import { isPublicProductStatus, PICKUP_SHIPPING_OPTION, type ProductStatus } from "@lm-3d/shared";
import { Router } from "express";
import { z } from "zod";
import { loadCheckoutProductsBySlug } from "../lib/checkout-products.js";
import {
  normalizePostalCode,
  quoteMelhorEnvioShipping,
  toPublicShippingOption
} from "../lib/melhor-envio.js";
import { HttpError } from "../lib/http.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";
import { getBearerToken } from "./orders.js";

const shippingQuoteSchema = z.object({
  address: z.object({
    postalCode: z.string().trim().min(1).max(30)
  }),
  items: z
    .array(
      z.object({
        productSlug: z.string().trim().min(1).max(120),
        quantity: z.coerce.number().int().min(1).max(99)
      })
    )
    .min(1)
    .max(40)
});

export const shippingRouter = Router();

function shouldReturnPickupOnly(error: unknown) {
  return (
    error instanceof HttpError &&
    [
      "MELHOR_ENVIO_NOT_CONFIGURED",
      "STORE_ORIGIN_POSTAL_CODE_NOT_CONFIGURED",
      "MELHOR_ENVIO_QUOTE_FAILED",
      "MELHOR_ENVIO_INVALID_RESPONSE",
      "MELHOR_ENVIO_TIMEOUT"
    ].includes(error.code)
  );
}

shippingRouter.post("/quote", async (req, res, next) => {
  try {
    const payload = shippingQuoteSchema.parse(req.body);
    const supabase = getSupabaseAdminClient();
    const token = getBearerToken(req.header("authorization"));

    if (!token) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Entre para calcular o frete do pedido.");
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new HttpError(401, "LOGIN_REQUIRED", "Sua sessao expirou. Entre novamente.");
    }

    const destinationPostalCode = normalizePostalCode(payload.address.postalCode);
    const requestedSlugs = [...new Set(payload.items.map((item) => item.productSlug))];
    const products = await loadCheckoutProductsBySlug(supabase, requestedSlugs);
    const productBySlug = new Map(
      products
        .filter((product) => isPublicProductStatus(product.status as ProductStatus))
        .map((product) => [product.slug, product])
    );
    const quoteProducts = payload.items.map((item) => {
      const product = productBySlug.get(item.productSlug);

      if (!product) {
        throw new HttpError(
          400,
          "PRODUCT_UNAVAILABLE",
          "Um dos produtos do carrinho nao esta disponivel para frete."
        );
      }

      return {
        ...product,
        quantity: item.quantity
      };
    });

    try {
      const quote = await quoteMelhorEnvioShipping({
        destinationPostalCode,
        products: quoteProducts
      });

      res.json({
        options: [PICKUP_SHIPPING_OPTION, ...quote.options.map(toPublicShippingOption)],
        unavailableServices: quote.unavailableServices
      });
    } catch (error) {
      if (!shouldReturnPickupOnly(error)) {
        throw error;
      }

      res.json({
        options: [PICKUP_SHIPPING_OPTION],
        unavailableServices: [
          {
            serviceName: "Melhor Envio",
            companyName: null,
            message:
              error instanceof Error
                ? error.message
                : "Nao foi possivel calcular fretes por transportadora agora."
          }
        ]
      });
    }
  } catch (error) {
    next(error);
  }
});
