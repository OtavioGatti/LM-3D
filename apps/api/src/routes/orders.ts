import { isPublicProductStatus, type ProductStatus } from "@lm-3d/shared";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  price_cents: number;
  status: string;
  material: string | null;
  dimensions: string | null;
  accepts_customization: boolean;
};

const checkoutOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(180),
    phone: z.string().trim().max(40).optional().nullable()
  }),
  delivery: z.object({
    method: z.enum(["retirada", "entrega_combinar"]).default("entrega_combinar"),
    address: z
      .object({
        line1: z.string().trim().max(180).optional().nullable(),
        city: z.string().trim().max(100).optional().nullable(),
        state: z.string().trim().max(60).optional().nullable(),
        postalCode: z.string().trim().max(30).optional().nullable()
      })
      .optional()
      .nullable()
  }),
  notes: z.string().trim().max(1200).optional().nullable(),
  items: z
    .array(
      z.object({
        productSlug: z.string().trim().min(1).max(120),
        quantity: z.coerce.number().int().min(1).max(99),
        notes: z.string().trim().max(800).optional().nullable()
      })
    )
    .min(1)
    .max(40)
});

export const ordersRouter = Router();

function getBearerToken(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

function createOrderCode() {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();

  return `LM3D-${stamp}-${suffix}`;
}

ordersRouter.post("/", async (req, res, next) => {
  try {
    const payload = checkoutOrderSchema.parse(req.body);
    const supabase = getSupabaseAdminClient();
    const token = getBearerToken(req.header("authorization"));
    const {
      data: { user }
    } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    const requestedSlugs = [...new Set(payload.items.map((item) => item.productSlug))];

    const { data: products, error: productError } = await supabase
      .from("products")
      .select(
        "id, slug, name, short_description, price_cents, status, material, dimensions, accepts_customization"
      )
      .in("slug", requestedSlugs);

    if (productError) {
      throw productError;
    }

    const productBySlug = new Map(
      ((products ?? []) as ProductRow[])
        .filter((product) => isPublicProductStatus(product.status as ProductStatus))
        .map((product) => [product.slug, product])
    );

    const orderItems = payload.items.map((item) => {
      const product = productBySlug.get(item.productSlug);

      if (!product) {
        throw new HttpError(
          400,
          "PRODUCT_UNAVAILABLE",
          "Um dos produtos do carrinho nao esta disponivel para compra."
        );
      }

      const lineTotalCents = product.price_cents * item.quantity;

      return {
        product_id: product.id,
        product_snapshot: {
          slug: product.slug,
          name: product.name,
          short_description: product.short_description,
          material: product.material,
          dimensions: product.dimensions,
          accepts_customization: product.accepts_customization
        },
        quantity: item.quantity,
        unit_price_cents: product.price_cents,
        line_total_cents: lineTotalCents,
        customization_notes: item.notes || null
      };
    });

    const subtotalCents = orderItems.reduce((total, item) => total + item.line_total_cents, 0);
    const code = createOrderCode();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        code,
        user_id: user?.id ?? null,
        customer_name: payload.customer.name,
        customer_email: payload.customer.email,
        customer_phone: payload.customer.phone || null,
        status: "pending_payment",
        payment_status: "pending",
        subtotal_cents: subtotalCents,
        shipping_cents: 0,
        discount_cents: 0,
        total_cents: subtotalCents,
        delivery_method:
          payload.delivery.method === "retirada" ? "Retirada com Lucas" : "Entrega a combinar",
        delivery_address: payload.delivery.address ?? null,
        customer_notes: payload.notes || null
      })
      .select("*")
      .single();

    if (orderError) {
      throw orderError;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      orderItems.map((item) => ({
        ...item,
        order_id: order.id
      }))
    );

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    const { error: paymentError } = await supabase.from("payments").insert({
      order_id: order.id,
      provider: "mercado_pago",
      external_reference: order.code,
      status: "pending",
      amount_cents: order.total_cents,
      currency: "BRL",
      raw_payload: {
        setup_status: "checkout_created_before_mercado_pago_configuration"
      }
    });

    if (paymentError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw paymentError;
    }

    res.status(201).json({
      order: {
        id: order.id,
        code: order.code,
        status: order.status,
        paymentStatus: order.payment_status,
        totalCents: order.total_cents
      }
    });
  } catch (error) {
    next(error);
  }
});
