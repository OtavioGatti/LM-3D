"use client";

import { formatMoneyBRL } from "@lm-3d/shared";
import { Calculator, Save } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { adminApiFetch } from "@/lib/api/admin";

type ProductOption = {
  id: string;
  name: string;
  price_cents: number;
};

type Preset = {
  id: string;
  name: string;
  filament_kg_cost_cents: number;
  kwh_cost_cents: number;
  printer_power_watts: number;
  marketplace_fee_percent: number;
  desired_margin_percent: number;
  packaging_cost_cents: number;
  labor_cost_cents: number;
  is_default: boolean;
};

type Calculation = {
  id: string;
  suggested_price_cents: number;
  operational_cost_cents: number;
  estimated_profit_cents: number;
  created_at: string;
  product?: { id: string; name: string } | null;
};

type CalculatorForm = {
  product_id: string;
  presetName: string;
  filamentKgCost: string;
  weightGrams: string;
  kwhCost: string;
  printerPowerWatts: string;
  printHours: string;
  packagingCost: string;
  finishingCost: string;
  marketplaceFeePercent: string;
  desiredMarginPercent: string;
  lossesCost: string;
  laborCost: string;
};

const emptyForm: CalculatorForm = {
  product_id: "",
  presetName: "Padrao LM-3D",
  filamentKgCost: "80,00",
  weightGrams: "100",
  kwhCost: "0,95",
  printerPowerWatts: "120",
  printHours: "4",
  packagingCost: "3,00",
  finishingCost: "0,00",
  marketplaceFeePercent: "5",
  desiredMarginPercent: "35",
  lossesCost: "0,00",
  laborCost: "0,00"
};

function numberValue(value: string) {
  return Number(value.replace(/\./g, "").replace(",", ".") || 0);
}

function cents(value: string) {
  return Math.round(numberValue(value) * 100);
}

function moneyInput(value: number) {
  return (value / 100).toFixed(2).replace(".", ",");
}

function percentInput(value: number) {
  return String(Number(value).toString()).replace(".", ",");
}

export function AdminPriceCalculator() {
  const [form, setForm] = useState<CalculatorForm>(emptyForm);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadData() {
    const [productsPayload, presetsPayload, calculationsPayload] = await Promise.all([
      adminApiFetch<{ products: ProductOption[] }>("/admin/products"),
      adminApiFetch<{ presets: Preset[] }>("/admin/price/presets"),
      adminApiFetch<{ calculations: Calculation[] }>("/admin/price/calculations")
    ]);

    setProducts(productsPayload.products);
    setPresets(presetsPayload.presets);
    setCalculations(calculationsPayload.calculations);

    const defaultPreset = presetsPayload.presets.find((preset) => preset.is_default);
    if (defaultPreset) {
      applyPreset(defaultPreset);
    }
  }

  useEffect(() => {
    void loadData().catch((error: Error) => setMessage(error.message));
  }, []);

  const result = useMemo(() => {
    const filamentCost = (cents(form.filamentKgCost) / 1000) * numberValue(form.weightGrams);
    const energyCost =
      (numberValue(form.printerPowerWatts) / 1000) *
      numberValue(form.printHours) *
      cents(form.kwhCost);
    const operationalCost =
      filamentCost +
      energyCost +
      cents(form.packagingCost) +
      cents(form.finishingCost) +
      cents(form.lossesCost) +
      cents(form.laborCost);
    const margin = numberValue(form.desiredMarginPercent) / 100;
    const fee = numberValue(form.marketplaceFeePercent) / 100;
    const denominator = 1 - margin - fee;
    const suggestedPrice = denominator > 0 ? Math.ceil(operationalCost / denominator) : 0;
    const minimumPrice = fee < 1 ? Math.ceil(operationalCost / (1 - fee)) : operationalCost;
    const estimatedProfit = suggestedPrice - operationalCost;

    return {
      filamentCost: Math.round(filamentCost),
      energyCost: Math.round(energyCost),
      operationalCost: Math.round(operationalCost),
      suggestedPrice: Math.round(suggestedPrice),
      minimumPrice: Math.round(minimumPrice),
      estimatedProfit: Math.round(estimatedProfit)
    };
  }, [form]);

  function applyPreset(preset: Preset) {
    setForm((current) => ({
      ...current,
      presetName: preset.name,
      filamentKgCost: moneyInput(preset.filament_kg_cost_cents),
      kwhCost: moneyInput(preset.kwh_cost_cents),
      printerPowerWatts: String(preset.printer_power_watts),
      marketplaceFeePercent: percentInput(preset.marketplace_fee_percent),
      desiredMarginPercent: percentInput(preset.desired_margin_percent),
      packagingCost: moneyInput(preset.packaging_cost_cents),
      laborCost: moneyInput(preset.labor_cost_cents)
    }));
  }

  async function savePreset() {
    setMessage("");
    setIsSaving(true);

    try {
      await adminApiFetch("/admin/price/presets", {
        method: "POST",
        body: JSON.stringify({
          name: form.presetName,
          filament_kg_cost_cents: cents(form.filamentKgCost),
          kwh_cost_cents: cents(form.kwhCost),
          printer_power_watts: Number(form.printerPowerWatts || 0),
          marketplace_fee_percent: numberValue(form.marketplaceFeePercent),
          desired_margin_percent: numberValue(form.desiredMarginPercent),
          packaging_cost_cents: cents(form.packagingCost),
          labor_cost_cents: cents(form.laborCost),
          is_default: true
        })
      });

      setMessage("Preset salvo como padrao.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o preset.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCalculation(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setMessage("");
    setIsSaving(true);

    try {
      await adminApiFetch("/admin/price/calculations", {
        method: "POST",
        body: JSON.stringify({
          product_id: form.product_id || null,
          input: form,
          filament_cost_cents: result.filamentCost,
          energy_cost_cents: result.energyCost,
          operational_cost_cents: result.operationalCost,
          suggested_price_cents: result.suggestedPrice,
          minimum_price_cents: result.minimumPrice,
          estimated_profit_cents: result.estimatedProfit
        })
      });

      setMessage("Calculo salvo.");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o cálculo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function applyPriceToProduct() {
    if (!form.product_id) {
      setMessage("Selecione um produto para aplicar o preço.");
      return;
    }

    setMessage("");
    setIsSaving(true);

    try {
      await adminApiFetch(`/admin/products/${form.product_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          price_cents: result.suggestedPrice
        })
      });
      await saveCalculation();
      setMessage("Preço sugerido aplicado ao produto.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível aplicar o preço.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="admin-panel split-panel">
      <form className="admin-form" onSubmit={(event) => void saveCalculation(event)}>
        <div className="form-grid">
          <label>
            Produto
            <select
              onChange={(event) => setForm({ ...form, product_id: event.target.value })}
              value={form.product_id}
            >
              <option value="">Calculo avulso</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Presets salvos
            <select
              onChange={(event) => {
                const preset = presets.find((item) => item.id === event.target.value);
                if (preset) applyPreset(preset);
              }}
              defaultValue=""
            >
              <option value="">Selecionar preset</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor do kg do filamento
            <input
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, filamentKgCost: event.target.value })}
              value={form.filamentKgCost}
            />
          </label>
          <label>
            Peso da impressão em gramas
            <input
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, weightGrams: event.target.value })}
              value={form.weightGrams}
            />
          </label>
          <label>
            Valor do kWh de energia
            <input
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, kwhCost: event.target.value })}
              value={form.kwhCost}
            />
          </label>
          <label>
            Potencia media da impressora em watts
            <input
              inputMode="numeric"
              onChange={(event) => setForm({ ...form, printerPowerWatts: event.target.value })}
              value={form.printerPowerWatts}
            />
          </label>
          <label>
            Horas de impressão
            <input
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, printHours: event.target.value })}
              value={form.printHours}
            />
          </label>
          <label>
            Custo de embalagem
            <input
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, packagingCost: event.target.value })}
              value={form.packagingCost}
            />
          </label>
          <label>
            Acabamento ou pintura
            <input
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, finishingCost: event.target.value })}
              value={form.finishingCost}
            />
          </label>
          <label>
            Taxa Mercado Pago %
            <input
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, marketplaceFeePercent: event.target.value })}
              value={form.marketplaceFeePercent}
            />
          </label>
          <label>
            Margem de lucro desejada %
            <input
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, desiredMarginPercent: event.target.value })}
              value={form.desiredMarginPercent}
            />
          </label>
          <label>
            Perdas ou retrabalho
            <input
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, lossesCost: event.target.value })}
              value={form.lossesCost}
            />
          </label>
          <label>
            Mao de obra
            <input
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, laborCost: event.target.value })}
              value={form.laborCost}
            />
          </label>
          <label>
            Nome do preset
            <input
              onChange={(event) => setForm({ ...form, presetName: event.target.value })}
              value={form.presetName}
            />
          </label>
        </div>

        {message ? <p className="form-note">{message}</p> : null}

        <div className="admin-inline-actions">
          <button className="button button-primary" disabled={isSaving} type="submit">
            <Save aria-hidden="true" size={18} />
            Salvar cálculo
          </button>
          <button className="button button-secondary" disabled={isSaving} type="button" onClick={() => void savePreset()}>
            Salvar preset padrao
          </button>
        </div>
      </form>

      <aside className="calculator-result">
        <Calculator aria-hidden="true" size={26} />
        <h2>Preço sugerido</h2>
        <strong>{formatMoneyBRL(result.suggestedPrice)}</strong>
        <div className="calculator-breakdown">
          <span>Filamento <strong>{formatMoneyBRL(result.filamentCost)}</strong></span>
          <span>Energia <strong>{formatMoneyBRL(result.energyCost)}</strong></span>
          <span>Custo total <strong>{formatMoneyBRL(result.operationalCost)}</strong></span>
          <span>Preço mínimo <strong>{formatMoneyBRL(result.minimumPrice)}</strong></span>
          <span>Lucro estimado <strong>{formatMoneyBRL(result.estimatedProfit)}</strong></span>
        </div>
        <p>
          Margem de lucro é calculada sobre o preço final. Markup seria aplicar um multiplicador
          sobre o custo; aqui o preço é ajustado para a margem desejada depois de custos e taxa.
        </p>
        <button className="button button-secondary" disabled={isSaving} type="button" onClick={() => void applyPriceToProduct()}>
          Aplicar ao produto
        </button>

        <div className="calculation-history">
          <h3>Últimos cálculos</h3>
          {calculations.map((calculation) => (
            <article key={calculation.id}>
              <span>{calculation.product?.name ?? "Cálculo avulso"}</span>
              <strong>{formatMoneyBRL(calculation.suggested_price_cents)}</strong>
              <small>
                Custo {formatMoneyBRL(calculation.operational_cost_cents)} · lucro{" "}
                {formatMoneyBRL(calculation.estimated_profit_cents)}
              </small>
            </article>
          ))}
        </div>
      </aside>
    </section>
  );
}
