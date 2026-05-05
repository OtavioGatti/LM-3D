export const PRODUCT_STATUSES = [
  "active",
  "draft",
  "archived",
  "out_of_stock",
  "made_to_order"
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "payment_failed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
  "canceled",
  "refunded"
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back"
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ADMIN_ROLES = ["owner"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isOwnerRole(role: string | null | undefined) {
  return role === "owner";
}

export function isPublicProductStatus(status: ProductStatus) {
  return status === "active" || status === "made_to_order";
}
