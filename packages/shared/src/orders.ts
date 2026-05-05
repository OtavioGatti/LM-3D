import type { Money } from "./money.js";
import type { OrderStatus, PaymentStatus } from "./status.js";

export type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  customizationNotes?: string;
};

export type OrderSummary = {
  id: string;
  code: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  total: Money;
  createdAt: string;
};
