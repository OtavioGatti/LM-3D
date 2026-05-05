export type Currency = "BRL";

export type Money = {
  amountInCents: number;
  currency: Currency;
};

export function brl(amountInCents: number): Money {
  return {
    amountInCents,
    currency: "BRL"
  };
}

export function formatMoneyBRL(amountInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(amountInCents / 100);
}

export function percentageToRate(percentage: number) {
  return percentage / 100;
}
