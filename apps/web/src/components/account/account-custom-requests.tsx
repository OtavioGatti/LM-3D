"use client";

import { formatMoneyBRL } from "@lm-3d/shared";
import { CheckCircle2, ClipboardList, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { createCustomRequestCheckout } from "@/lib/api/custom-requests";
import { getSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type AccountCustomRequest = {
  id: string;
  code: string;
  title: string;
  description: string;
  quantity: number;
  desired_material: string | null;
  desired_colors: string | null;
  deadline: string | null;
  reference_url: string | null;
  status: "new" | "contacted" | "quoted" | "converted" | "closed" | "canceled";
  estimated_price_cents: number | null;
  quote_message: string | null;
  created_at: string;
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

    return <span key={`${part}-${index}`}>{part}</span>;
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
          reference_url,
          status,
          estimated_price_cents,
          created_at
        `;
      let { data, error } = await supabase
        .from("custom_requests")
        .select(selectWithQuoteMessage)
        .order("created_at", { ascending: false });

      if (error?.message.includes("quote_message")) {
        const fallback = await supabase
          .from("custom_requests")
          .select(selectWithoutQuoteMessage)
          .order("created_at", { ascending: false });

        data = (fallback.data ?? []).map((request) => ({ ...request, quote_message: null }));
        error = fallback.error;
      }

      if (error) {
        setMessage(error.message);
      } else {
        setRequests((data ?? []) as AccountCustomRequest[]);
      }

      setIsLoading(false);
    }

    void loadRequests();
  }, []);

  async function payCustomRequest(request: AccountCustomRequest) {
    setMessage("");
    setPayingCode(request.code);

    try {
      const payload = await createCustomRequestCheckout(request.code);

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
            {request.deadline ? <span>Prazo: {request.deadline}</span> : null}
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
            <button
              className="button button-primary"
              disabled={payingCode === request.code}
              onClick={() => void payCustomRequest(request)}
              type="button"
            >
              <CreditCard aria-hidden="true" size={18} />
              {payingCode === request.code ? "Abrindo pagamento..." : "Pagar orçamento"}
            </button>
          ) : null}
        </article>
      ))}
    </section>
  );
}
