"use client";

import {
  formatBrazilianPhone,
  formatMoneyBRL,
  PICKUP_SHIPPING_OPTION,
  type ShippingQuoteOption
} from "@lm-3d/shared";
import { CheckCircle2, ClipboardList, CreditCard, MapPin, PackageCheck, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createCustomRequestCheckout,
  createCustomRequestGroupCheckout,
  quoteCustomRequestGroupShipping,
  quoteCustomRequestShipping
} from "@/lib/api/custom-requests";
import { formatBrazilianDocument, formatPostalCode, formatStateCode } from "@/lib/forms/formatters";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { TextField } from "@/components/ui/form-field";

type AccountCustomRequest = {
  id: string;
  code: string;
  title: string;
  description: string;
  quantity: number;
  desired_material: string | null;
  desired_colors: string | null;
  deadline: string | null;
  quoted_deadline: string | null;
  reference_url: string | null;
  status: "new" | "contacted" | "quoted" | "converted" | "closed" | "canceled";
  estimated_price_cents: number | null;
  quote_message: string | null;
  created_at: string;
};

type PaymentShippingForm = {
  phone: string;
  document: string;
  addressLine: string;
  addressNumber: string;
  district: string;
  complement: string;
  city: string;
  state: string;
  postalCode: string;
};

const emptyPaymentShippingForm: PaymentShippingForm = {
  phone: "",
  document: "",
  addressLine: "",
  addressNumber: "",
  district: "",
  complement: "",
  city: "",
  state: "",
  postalCode: ""
};

const statusLabels: Record<AccountCustomRequest["status"], string> = {
  new: "Recebido",
  contacted: "Contato feito",
  quoted: "Orçado",
  converted: "Convertido em pedido",
  closed: "Fechado",
  canceled: "Cancelado"
};

const statusSteps = [
  { key: "new", label: "Recebido" },
  { key: "contacted", label: "Em avaliação" },
  { key: "quoted", label: "Orçado" },
  { key: "converted", label: "Pedido gerado" }
] as const;

function statusStepIndex(status: AccountCustomRequest["status"]) {
  if (status === "canceled") {
    return -1;
  }

  if (status === "closed") {
    return 2;
  }

  const index = statusSteps.findIndex((step) => step.key === status);

  return index === -1 ? 0 : index;
}

function requestHighlight(request: AccountCustomRequest) {
  if (request.status === "canceled") {
    return "Cancelado";
  }

  if (request.status === "closed") {
    return "Fechado";
  }

  if (request.status === "converted") {
    return "Pedido gerado";
  }

  if (request.status === "quoted") {
    return request.estimated_price_cents
      ? formatMoneyBRL(request.estimated_price_cents)
      : "Orçado";
  }

  if (request.status === "contacted") {
    return "Em avaliação";
  }

  return "Em análise";
}

function renderFormattedLine(line: string) {
  return line.split(/(\*\*.+?\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function FormattedQuoteMessage({ text }: { text: string }) {
  return (
    <div className="quote-message-body">
      {text.split(/\r?\n/).map((line, index) =>
        line.trim() ? (
          <p key={`${line}-${index}`}>{renderFormattedLine(line)}</p>
        ) : (
          <span aria-hidden="true" className="quote-message-spacer" key={`blank-${index}`} />
        )
      )}
    </div>
  );
}

export function AccountCustomRequests() {
  const [requests, setRequests] = useState<AccountCustomRequest[]>([]);
  const [message, setMessage] = useState("");
  const [payingCode, setPayingCode] = useState("");
  const [paymentPanelCode, setPaymentPanelCode] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [shippingForm, setShippingForm] = useState(emptyPaymentShippingForm);
  const [shippingOptions, setShippingOptions] = useState<ShippingQuoteOption[]>([
    PICKUP_SHIPPING_OPTION
  ]);
  const [selectedShippingOptionId, setSelectedShippingOptionId] = useState(PICKUP_SHIPPING_OPTION.id);
  const [shippingMessage, setShippingMessage] = useState("");
  const [isQuotingShipping, setIsQuotingShipping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadRequests() {
      if (!hasSupabaseBrowserConfig()) {
        setIsLoading(false);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const selectWithQuoteMessage = `
          id,
          code,
          title,
          description,
          quantity,
          desired_material,
          desired_colors,
          deadline,
          quoted_deadline,
          reference_url,
          status,
          estimated_price_cents,
          quote_message,
          created_at
        `;
      const selectWithoutQuoteMessage = `
          id,
          code,
          title,
          description,
          quantity,
          desired_material,
          desired_colors,
          deadline,
          quoted_deadline,
          reference_url,
          status,
          estimated_price_cents,
          created_at
        `;
      let { data, error } = await supabase
        .from("custom_requests")
        .select(selectWithQuoteMessage)
        .order("created_at", { ascending: false });
      let requestsData = (data ?? []) as unknown as AccountCustomRequest[];

      if (error?.message.includes("quoted_deadline")) {
        const fallback = await supabase
          .from("custom_requests")
          .select(selectWithQuoteMessage.replace("quoted_deadline,", ""))
          .order("created_at", { ascending: false });
        const fallbackRows = (fallback.data ?? []) as unknown as Array<Record<string, unknown>>;

        requestsData = fallbackRows.map((request) => ({
          ...request,
          quoted_deadline: null
        })) as unknown as AccountCustomRequest[];
        error = fallback.error;
      }

      if (error?.message.includes("quote_message")) {
        const fallback = await supabase
          .from("custom_requests")
          .select(selectWithoutQuoteMessage.replace("quoted_deadline,", ""))
          .order("created_at", { ascending: false });
        const fallbackRows = (fallback.data ?? []) as unknown as Array<Record<string, unknown>>;

        requestsData = fallbackRows.map((request) => ({
          ...request,
          quote_message: null,
          quoted_deadline: null
        })) as unknown as AccountCustomRequest[];
        error = fallback.error;
      }

      if (error) {
        setMessage(error.message);
      } else {
        setRequests(requestsData);
      }

      setIsLoading(false);
    }

    void loadRequests();
  }, []);

  const payableRequests = requests.filter(
    (request) => request.status === "quoted" && request.estimated_price_cents
  );
  const selectedPayableRequests = payableRequests.filter((request) =>
    selectedRequestIds.includes(request.id)
  );
  const groupSubtotalCents = selectedPayableRequests.reduce(
    (total, request) => total + (request.estimated_price_cents ?? 0),
    0
  );

  function openPaymentPanel(request: AccountCustomRequest) {
    setMessage("");
    setShippingMessage("");
    setPaymentPanelCode((current) => (current === request.code ? "" : request.code));
    setShippingOptions([PICKUP_SHIPPING_OPTION]);
    setSelectedShippingOptionId(PICKUP_SHIPPING_OPTION.id);
  }

  function openGroupPaymentPanel() {
    setMessage("");
    setShippingMessage("");
    setPaymentPanelCode((current) => (current === "group" ? "" : "group"));
    setShippingOptions([PICKUP_SHIPPING_OPTION]);
    setSelectedShippingOptionId(PICKUP_SHIPPING_OPTION.id);
  }

  function toggleSelectedRequest(requestId: string) {
    setSelectedRequestIds((current) =>
      current.includes(requestId)
        ? current.filter((item) => item !== requestId)
        : [...current, requestId]
    );
  }

  function formatDeliveryTime(option: ShippingQuoteOption) {
    if (option.provider === "pickup") {
      return "sem custo";
    }

    if (option.deliveryTimeDays === null) {
      return "prazo informado pela transportadora";
    }

    return `${option.deliveryTimeDays} dia(s) util(eis)`;
  }

  async function calculateCustomRequestShipping(request: AccountCustomRequest) {
    setShippingMessage("");
    setIsQuotingShipping(true);

    try {
      if (!shippingForm.postalCode.trim()) {
        throw new Error("Informe o CEP para calcular o frete.");
      }

      const response = await quoteCustomRequestShipping(request.code, shippingForm.postalCode);
      const options = response.options.some((option) => option.id === PICKUP_SHIPPING_OPTION.id)
        ? response.options
        : [PICKUP_SHIPPING_OPTION, ...response.options];
      const carrierOption = options.find((option) => option.provider === "melhor_envio");

      setShippingOptions(options);
      setSelectedShippingOptionId(carrierOption?.id ?? PICKUP_SHIPPING_OPTION.id);
      setShippingMessage(
        carrierOption
          ? "Fretes atualizados."
          : response.unavailableServices[0]?.message ?? "Nao encontramos frete para este CEP agora."
      );
    } catch (error) {
      setShippingOptions([PICKUP_SHIPPING_OPTION]);
      setSelectedShippingOptionId(PICKUP_SHIPPING_OPTION.id);
      setShippingMessage(error instanceof Error ? error.message : "Nao foi possivel calcular o frete.");
    } finally {
      setIsQuotingShipping(false);
    }
  }

  async function calculateCustomRequestGroupShipping() {
    setShippingMessage("");
    setIsQuotingShipping(true);

    try {
      if (selectedPayableRequests.length === 0) {
        throw new Error("Selecione ao menos um orcamento para calcular o frete.");
      }

      if (!shippingForm.postalCode.trim()) {
        throw new Error("Informe o CEP para calcular o frete.");
      }

      const response = await quoteCustomRequestGroupShipping(
        selectedPayableRequests.map((request) => request.code),
        shippingForm.postalCode
      );
      const options = response.options.some((option) => option.id === PICKUP_SHIPPING_OPTION.id)
        ? response.options
        : [PICKUP_SHIPPING_OPTION, ...response.options];
      const carrierOption = options.find((option) => option.provider === "melhor_envio");

      setShippingOptions(options);
      setSelectedShippingOptionId(carrierOption?.id ?? PICKUP_SHIPPING_OPTION.id);
      setShippingMessage(
        carrierOption
          ? "Fretes atualizados para os orcamentos selecionados."
          : response.unavailableServices[0]?.message ?? "Nao encontramos frete para este CEP agora."
      );
    } catch (error) {
      setShippingOptions([PICKUP_SHIPPING_OPTION]);
      setSelectedShippingOptionId(PICKUP_SHIPPING_OPTION.id);
      setShippingMessage(error instanceof Error ? error.message : "Nao foi possivel calcular o frete.");
    } finally {
      setIsQuotingShipping(false);
    }
  }

  async function payCustomRequest(request: AccountCustomRequest) {
    setMessage("");
    setPayingCode(request.code);

    try {
      const selectedShippingOption = shippingOptions.find(
        (option) => option.id === selectedShippingOptionId
      );

      if (!selectedShippingOption) {
        throw new Error("Escolha retirada em Assis/SP ou uma opcao de frete.");
      }

      if (
        selectedShippingOption.provider === "melhor_envio" &&
        (!shippingForm.phone.trim() ||
          !shippingForm.document.trim() ||
          !shippingForm.addressLine.trim() ||
          !shippingForm.addressNumber.trim() ||
          !shippingForm.district.trim() ||
          !shippingForm.city.trim() ||
          !shippingForm.state.trim() ||
          !shippingForm.postalCode.trim())
      ) {
        throw new Error("Preencha telefone, CPF/CNPJ e endereco completo para envio.");
      }

      const payload = await createCustomRequestCheckout(request.code, {
        customer: {
          phone: shippingForm.phone || null,
          document: shippingForm.document || null
        },
        delivery: {
          method: selectedShippingOption.provider === "pickup" ? "retirada" : "melhor_envio",
          address:
            selectedShippingOption.provider === "melhor_envio"
              ? {
                  line1: shippingForm.addressLine || null,
                  number: shippingForm.addressNumber || null,
                  district: shippingForm.district || null,
                  complement: shippingForm.complement || null,
                  city: shippingForm.city || null,
                  state: shippingForm.state || null,
                  postalCode: shippingForm.postalCode || null
                }
              : null
        },
        shipping: {
          optionId: selectedShippingOption.id,
          provider: selectedShippingOption.provider,
          serviceId: selectedShippingOption.serviceId
        }
      });

      if (!payload.payment.checkoutUrl) {
        throw new Error("O Mercado Pago não retornou uma URL de pagamento.");
      }

      window.location.assign(payload.payment.checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setPayingCode("");
    }
  }

  async function payCustomRequestGroup() {
    setMessage("");
    setPayingCode("group");

    try {
      if (selectedPayableRequests.length === 0) {
        throw new Error("Selecione ao menos um orcamento para pagar.");
      }

      const selectedShippingOption = shippingOptions.find(
        (option) => option.id === selectedShippingOptionId
      );

      if (!selectedShippingOption) {
        throw new Error("Escolha retirada em Assis/SP ou uma opcao de frete.");
      }

      if (
        selectedShippingOption.provider === "melhor_envio" &&
        (!shippingForm.phone.trim() ||
          !shippingForm.document.trim() ||
          !shippingForm.addressLine.trim() ||
          !shippingForm.addressNumber.trim() ||
          !shippingForm.district.trim() ||
          !shippingForm.city.trim() ||
          !shippingForm.state.trim() ||
          !shippingForm.postalCode.trim())
      ) {
        throw new Error("Preencha telefone, CPF/CNPJ e endereco completo para envio.");
      }

      const payload = await createCustomRequestGroupCheckout(
        selectedPayableRequests.map((request) => request.code),
        {
          customer: {
            phone: shippingForm.phone || null,
            document: shippingForm.document || null
          },
          delivery: {
            method: selectedShippingOption.provider === "pickup" ? "retirada" : "melhor_envio",
            address:
              selectedShippingOption.provider === "melhor_envio"
                ? {
                    line1: shippingForm.addressLine || null,
                    number: shippingForm.addressNumber || null,
                    district: shippingForm.district || null,
                    complement: shippingForm.complement || null,
                    city: shippingForm.city || null,
                    state: shippingForm.state || null,
                    postalCode: shippingForm.postalCode || null
                  }
                : null
          },
          shipping: {
            optionId: selectedShippingOption.id,
            provider: selectedShippingOption.provider,
            serviceId: selectedShippingOption.serviceId
          }
        }
      );

      if (!payload.payment.checkoutUrl) {
        throw new Error("O Mercado Pago nao retornou uma URL de pagamento.");
      }

      window.location.assign(payload.payment.checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel iniciar o pagamento.");
    } finally {
      setPayingCode("");
    }
  }

  return (
    <section className="account-orders">
      <div className="account-section-header">
        <div>
          <h2>Meus orçamentos</h2>
          <p>Ideias personalizadas enviadas para avaliação do Lucas.</p>
        </div>
      </div>

      {message ? <p className="form-error">{message}</p> : null}
      {isLoading ? <p className="form-note">Carregando orçamentos...</p> : null}

      {!isLoading && requests.length === 0 ? (
        <div className="empty-state">
          <ClipboardList aria-hidden="true" size={26} />
          <h2>Nenhum orçamento enviado ainda</h2>
          <p>Quando você enviar uma ideia personalizada logado, ela aparecerá aqui.</p>
        </div>
      ) : null}

      {payableRequests.length > 1 ? (
        <article className="account-order-card">
          <header>
            <div>
              <strong>Pagar varios orcamentos juntos</strong>
              <span>Selecione os orcamentos prontos e finalize em um unico pagamento.</span>
            </div>
            <strong>{formatMoneyBRL(groupSubtotalCents)}</strong>
          </header>

          <div className="account-order-items">
            {payableRequests.map((request) => (
              <label className="checkbox-row" key={request.id}>
                <input
                  checked={selectedRequestIds.includes(request.id)}
                  onChange={() => toggleSelectedRequest(request.id)}
                  type="checkbox"
                />
                <span>
                  <strong>{request.code}</strong> - {request.title} -{" "}
                  {formatMoneyBRL(request.estimated_price_cents ?? 0)}
                </span>
              </label>
            ))}
          </div>

          <div className="summary-total">
            <span>{selectedPayableRequests.length} orcamento(s) selecionado(s)</span>
            <strong>{formatMoneyBRL(groupSubtotalCents)}</strong>
          </div>

          <button
            className="button button-primary"
            disabled={selectedPayableRequests.length === 0 || payingCode === "group"}
            onClick={openGroupPaymentPanel}
            type="button"
          >
            <CreditCard aria-hidden="true" size={18} />
            {paymentPanelCode === "group" ? "Fechar opcoes de entrega" : "Pagar selecionados"}
          </button>

          {paymentPanelCode === "group" ? (
            <div className="shipping-box">
              <div className="shipping-box-header">
                <Truck aria-hidden="true" size={22} />
                <div>
                  <h2>Entrega dos orcamentos</h2>
                  <p>Escolha retirada gratuita ou calcule um frete unico para todos os itens.</p>
                </div>
              </div>

              <div className="shipping-option-list">
                {shippingOptions.map((option) => {
                  const isSelected = selectedShippingOptionId === option.id;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className="shipping-option-button"
                      data-selected={isSelected}
                      key={option.id}
                      onClick={() => setSelectedShippingOptionId(option.id)}
                      type="button"
                    >
                      <span>
                        {option.provider === "pickup" ? (
                          <PackageCheck aria-hidden="true" size={18} />
                        ) : (
                          <Truck aria-hidden="true" size={18} />
                        )}
                        <strong>{option.label}</strong>
                      </span>
                      <small>{formatDeliveryTime(option)}</small>
                      <strong>{formatMoneyBRL(option.priceCents)}</strong>
                    </button>
                  );
                })}
              </div>

              <div className="form-grid">
                <TextField
                  autoComplete="tel"
                  hint="Necessario para transportadora e contato sobre a entrega."
                  inputMode="tel"
                  label="WhatsApp ou telefone"
                  onChange={(event) =>
                    setShippingForm({
                      ...shippingForm,
                      phone: formatBrazilianPhone(event.target.value)
                    })
                  }
                  placeholder="(11) 99999-9999"
                  required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                  value={shippingForm.phone}
                />
                <TextField
                  hint="Usado somente para emissao da etiqueta de envio."
                  inputMode="numeric"
                  label="CPF ou CNPJ"
                  onChange={(event) =>
                    setShippingForm({
                      ...shippingForm,
                      document: formatBrazilianDocument(event.target.value)
                    })
                  }
                  placeholder="000.000.000-00"
                  required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                  value={shippingForm.document}
                />
                <TextField
                  label="Rua ou avenida"
                  onChange={(event) =>
                    setShippingForm({ ...shippingForm, addressLine: event.target.value })
                  }
                  placeholder="Rua Cardoso de Melo"
                  required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                  value={shippingForm.addressLine}
                />
                <TextField
                  label="Numero"
                  onChange={(event) =>
                    setShippingForm({ ...shippingForm, addressNumber: event.target.value })
                  }
                  placeholder="940"
                  required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                  value={shippingForm.addressNumber}
                />
                <TextField
                  label="Bairro"
                  onChange={(event) =>
                    setShippingForm({ ...shippingForm, district: event.target.value })
                  }
                  required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                  value={shippingForm.district}
                />
                <TextField
                  label="Complemento"
                  onChange={(event) =>
                    setShippingForm({ ...shippingForm, complement: event.target.value })
                  }
                  placeholder="Apto, bloco, referencia"
                  value={shippingForm.complement}
                />
                <TextField
                  label="Cidade"
                  onChange={(event) =>
                    setShippingForm({ ...shippingForm, city: event.target.value })
                  }
                  required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                  value={shippingForm.city}
                />
                <TextField
                  label="Estado"
                  maxLength={2}
                  onChange={(event) =>
                    setShippingForm({
                      ...shippingForm,
                      state: formatStateCode(event.target.value)
                    })
                  }
                  placeholder="SP"
                  required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                  value={shippingForm.state}
                />
                <TextField
                  hint="Digite o CEP e calcule o frete antes de pagar."
                  inputMode="numeric"
                  label="CEP"
                  onChange={(event) =>
                    setShippingForm({
                      ...shippingForm,
                      postalCode: formatPostalCode(event.target.value)
                    })
                  }
                  placeholder="19800-000"
                  required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                  value={shippingForm.postalCode}
                />
              </div>

              <button
                className="button button-secondary"
                disabled={isQuotingShipping}
                onClick={() => void calculateCustomRequestGroupShipping()}
                type="button"
              >
                <MapPin aria-hidden="true" size={18} />
                {isQuotingShipping ? "Calculando frete..." : "Calcular frete"}
              </button>
              {shippingMessage ? <p className="form-note">{shippingMessage}</p> : null}

              <div className="summary-total">
                <span>Total com entrega</span>
                <strong>
                  {formatMoneyBRL(
                    groupSubtotalCents +
                      (shippingOptions.find((option) => option.id === selectedShippingOptionId)
                        ?.priceCents ?? 0)
                  )}
                </strong>
              </div>

              <button
                className="button button-primary"
                disabled={payingCode === "group" || selectedPayableRequests.length === 0}
                onClick={() => void payCustomRequestGroup()}
                type="button"
              >
                <CreditCard aria-hidden="true" size={18} />
                {payingCode === "group" ? "Abrindo pagamento..." : "Ir para o Mercado Pago"}
              </button>
            </div>
          ) : null}
        </article>
      ) : null}

      {requests.map((request) => (
        <article className="account-order-card" key={request.id}>
          <header>
            <div>
              <strong>{request.title}</strong>
              <span>
                {request.code} - {new Intl.DateTimeFormat("pt-BR").format(new Date(request.created_at))}
              </span>
            </div>
            <strong>{requestHighlight(request)}</strong>
          </header>

          <div className="checkout-assurance">
            <span>{statusLabels[request.status]}</span>
            <span>Quantidade: {request.quantity}</span>
            {request.status === "quoted" && request.estimated_price_cents ? (
              <span>Pagamento liberado</span>
            ) : null}
            {request.quoted_deadline ? <span>Prazo informado: {request.quoted_deadline}</span> : null}
            {!request.quoted_deadline && request.deadline ? <span>Prazo desejado: {request.deadline}</span> : null}
          </div>

          <p>{request.description}</p>

          <div className="request-timeline" aria-label={`Andamento do orçamento ${request.code}`}>
            {statusSteps.map((step, index) => {
              const currentIndex = statusStepIndex(request.status);
              const isDone = currentIndex >= index;
              const isCurrent = currentIndex === index;

              return (
                <div className="request-timeline-step" data-active={isDone} key={step.key}>
                  <span>
                    {isDone ? <CheckCircle2 aria-hidden="true" size={14} /> : index + 1}
                  </span>
                  <strong>{step.label}</strong>
                  {isCurrent ? <small>Etapa atual</small> : null}
                </div>
              );
            })}
          </div>

          {request.quote_message ? (
            <div className="quote-message">
              <span>Mensagem do Lucas</span>
              <FormattedQuoteMessage text={request.quote_message} />
            </div>
          ) : null}

          <div className="account-order-items">
            <div>
              <span>Material</span>
              <strong>{request.desired_material ?? "A combinar"}</strong>
              {request.quoted_deadline ? <small>Prazo informado: {request.quoted_deadline}</small> : null}
              {request.deadline ? <small>Prazo desejado: {request.deadline}</small> : null}
              {request.desired_colors ? <small>Cores: {request.desired_colors}</small> : null}
              {request.reference_url ? (
                <small>
                  Referência:{" "}
                  <a className="text-link" href={request.reference_url} rel="noreferrer" target="_blank">
                    abrir link
                  </a>
                </small>
              ) : null}
            </div>
          </div>

          {request.status === "quoted" && request.estimated_price_cents ? (
            <>
            <button
              className="button button-primary"
              disabled={payingCode === request.code}
              onClick={() => openPaymentPanel(request)}
              type="button"
            >
              <CreditCard aria-hidden="true" size={18} />
              {paymentPanelCode === request.code ? "Fechar opcoes de entrega" : "Pagar orcamento"}
            </button>
            {paymentPanelCode === request.code ? (
              <div className="shipping-box">
                <div className="shipping-box-header">
                  <Truck aria-hidden="true" size={22} />
                  <div>
                    <h2>Entrega do orcamento</h2>
                    <p>Escolha retirada gratuita ou calcule o frete antes do Mercado Pago.</p>
                  </div>
                </div>

                <div className="shipping-option-list">
                  {shippingOptions.map((option) => {
                    const isSelected = selectedShippingOptionId === option.id;

                    return (
                      <button
                        aria-pressed={isSelected}
                        className="shipping-option-button"
                        data-selected={isSelected}
                        key={option.id}
                        onClick={() => setSelectedShippingOptionId(option.id)}
                        type="button"
                      >
                        <span>
                          {option.provider === "pickup" ? (
                            <PackageCheck aria-hidden="true" size={18} />
                          ) : (
                            <Truck aria-hidden="true" size={18} />
                          )}
                          <strong>{option.label}</strong>
                        </span>
                        <small>{formatDeliveryTime(option)}</small>
                        <strong>{formatMoneyBRL(option.priceCents)}</strong>
                      </button>
                    );
                  })}
                </div>

                <div className="form-grid">
                  <TextField
                    autoComplete="tel"
                    hint="Necessário para transportadora e contato sobre a entrega."
                    inputMode="tel"
                    label="WhatsApp ou telefone"
                    onChange={(event) =>
                      setShippingForm({
                        ...shippingForm,
                        phone: formatBrazilianPhone(event.target.value)
                      })
                    }
                    placeholder="(11) 99999-9999"
                    required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                    value={shippingForm.phone}
                  />
                  <TextField
                    hint="Usado somente para emissão da etiqueta de envio."
                    inputMode="numeric"
                    label="CPF ou CNPJ"
                    onChange={(event) =>
                      setShippingForm({
                        ...shippingForm,
                        document: formatBrazilianDocument(event.target.value)
                      })
                    }
                    placeholder="000.000.000-00"
                    required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                    value={shippingForm.document}
                  />
                  <TextField
                    label="Rua ou avenida"
                    onChange={(event) =>
                      setShippingForm({ ...shippingForm, addressLine: event.target.value })
                    }
                    placeholder="Rua Cardoso de Melo"
                    required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                    value={shippingForm.addressLine}
                  />
                  <TextField
                    label="Número"
                    onChange={(event) =>
                      setShippingForm({ ...shippingForm, addressNumber: event.target.value })
                    }
                    placeholder="940"
                    required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                    value={shippingForm.addressNumber}
                  />
                  <TextField
                    label="Bairro"
                    onChange={(event) =>
                      setShippingForm({ ...shippingForm, district: event.target.value })
                    }
                    required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                    value={shippingForm.district}
                  />
                  <TextField
                    label="Complemento"
                    onChange={(event) =>
                      setShippingForm({ ...shippingForm, complement: event.target.value })
                    }
                    placeholder="Apto, bloco, referência"
                    value={shippingForm.complement}
                  />
                  <TextField
                    label="Cidade"
                    onChange={(event) =>
                      setShippingForm({ ...shippingForm, city: event.target.value })
                    }
                    required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                    value={shippingForm.city}
                  />
                  <TextField
                    label="Estado"
                    maxLength={2}
                    onChange={(event) =>
                      setShippingForm({
                        ...shippingForm,
                        state: formatStateCode(event.target.value)
                      })
                    }
                    placeholder="SP"
                    required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                    value={shippingForm.state}
                  />
                  <TextField
                    hint="Digite o CEP e calcule o frete antes de pagar."
                    inputMode="numeric"
                    label="CEP"
                    onChange={(event) =>
                      setShippingForm({
                        ...shippingForm,
                        postalCode: formatPostalCode(event.target.value)
                      })
                    }
                    placeholder="19800-000"
                    required={selectedShippingOptionId !== PICKUP_SHIPPING_OPTION.id}
                    value={shippingForm.postalCode}
                  />
                </div>

                <button
                  className="button button-secondary"
                  disabled={isQuotingShipping}
                  onClick={() => void calculateCustomRequestShipping(request)}
                  type="button"
                >
                  <MapPin aria-hidden="true" size={18} />
                  {isQuotingShipping ? "Calculando frete..." : "Calcular frete"}
                </button>
                {shippingMessage ? <p className="form-note">{shippingMessage}</p> : null}

                <div className="summary-total">
                  <span>Total com entrega</span>
                  <strong>
                    {formatMoneyBRL(
                      request.estimated_price_cents +
                        (shippingOptions.find((option) => option.id === selectedShippingOptionId)
                          ?.priceCents ?? 0)
                    )}
                  </strong>
                </div>

                <button
                  className="button button-primary"
                  disabled={payingCode === request.code}
                  onClick={() => void payCustomRequest(request)}
                  type="button"
                >
                  <CreditCard aria-hidden="true" size={18} />
                  {payingCode === request.code ? "Abrindo pagamento..." : "Ir para o Mercado Pago"}
                </button>
              </div>
            ) : null}
            </>
          ) : null}
        </article>
      ))}
    </section>
  );
}
