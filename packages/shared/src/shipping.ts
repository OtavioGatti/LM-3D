export type ShippingProvider = "pickup" | "melhor_envio";

export type ShippingQuoteOption = {
  id: string;
  provider: ShippingProvider;
  serviceId: string | null;
  serviceName: string;
  companyName: string | null;
  label: string;
  priceCents: number;
  deliveryTimeDays: number | null;
};

export type ShippingQuoteResponse = {
  options: ShippingQuoteOption[];
  unavailableServices: Array<{
    serviceName: string;
    companyName: string | null;
    message: string;
  }>;
};

export const PICKUP_SHIPPING_OPTION: ShippingQuoteOption = {
  id: "pickup:assis-sp",
  provider: "pickup",
  serviceId: null,
  serviceName: "Retirada em Assis/SP",
  companyName: "LM-3D",
  label: "Retirada em Assis/SP",
  priceCents: 0,
  deliveryTimeDays: null
};
