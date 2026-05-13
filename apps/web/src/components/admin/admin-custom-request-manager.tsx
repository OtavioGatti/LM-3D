"use client";

import { formatMoneyBRL, getBrazilianPhoneHref, getBrazilianWhatsAppHref } from "@lm-3d/shared";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { adminApiFetch } from "@/lib/api/admin";

const customRequestStatuses = [
  "todos",
  "new",
  "contacted",
  "quoted",
  "converted",
  "closed",
  "canceled"
] as const;

type CustomRequestStatus = (typeof customRequestStatuses)[number];

type CustomRequest = {
  id: string;
  code: string;
  customer_name: string;
  customer_contact: string;
  customer_email: string | null;
  customer_phone: string | null;
  title: string;
  description: string;
  quantity: number;
  desired_material: string | null;
  desired_colors: string | null;
  deadline: string | null;
  quoted_deadline: string | null;
  reference_url: string | null;
  status: Exclude<CustomRequestStatus, "todos">;
  estimated_price_cents: number | null;
  quoted_weight_grams: number | null;
  quoted_package_width_cm: number | null;
  quoted_package_height_cm: number | null;
  quoted_package_length_cm: number | null;
  quote_message: string | null;
  admin_notes: string | null;
  created_at: string;
};

const statusLabels: Record<Exclude<CustomRequestStatus, "todos">, string> = {
  new: "Novo",
  contacted: "Contato feito",
  quoted: "Orcado",
  converted: "Convertido",
  closed: "Fechado",
  canceled: "Cancelado"
};

function parsePriceToCents(value: string) {
  if (!value.trim()) {
    return null;
  }

  return Math.round(Number(value.replace(/\./g, "").replace(",", ".")) * 100);
}

function parseNullableNumber(value: string) {
  return value.trim() ? Number(value.replace(",", ".")) : null;
}

function getRequestSummary(request: CustomRequest) {
  return `${request.quantity}x ${request.title}`;
}

function getPackageSummary(request: CustomRequest) {
  const hasPackage =
    request.quoted_weight_grams ||
    request.quoted_package_width_cm ||
    request.quoted_package_height_cm ||
    request.quoted_package_length_cm;

  if (!hasPackage) {
    return null;
  }

  return [
    request.quoted_weight_grams ? `${request.quoted_weight_grams}g` : null,
    request.quoted_package_width_cm &&
    request.quoted_package_height_cm &&
    request.quoted_package_length_cm
      ? `${request.quoted_package_width_cm} x ${request.quoted_package_height_cm} x ${request.quoted_package_length_cm} cm`
      : null
  ]
    .filter(Boolean)
    .join(" - ");
}

export function AdminCustomRequestManager() {
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CustomRequestStatus>("todos");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadRequests() {
    setIsLoading(true);
    const payload = await adminApiFetch<{ requests: CustomRequest[] }>("/admin/custom-requests");
    setRequests(payload.requests);
    setIsLoading(false);
  }

  useEffect(() => {
    void loadRequests().catch((error: Error) => {
      setMessage(error.message);
      setIsLoading(false);
    });
  }, []);

  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus = status === "todos" || request.status === status;
      const searchable = [
        request.code,
        request.customer_name,
        request.customer_contact,
        request.customer_email,
        request.customer_phone,
        request.title,
        request.description
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [query, requests, status]);

  useEffect(() => {
    if (expandedRequestId && !filteredRequests.some((request) => request.id === expandedRequestId)) {
      setExpandedRequestId(null);
    }
  }, [expandedRequestId, filteredRequests]);

  async function updateRequest(request: CustomRequest, updates: Partial<CustomRequest>) {
    setSavingId(request.id);
    setMessage("");

    try {
      const response = await adminApiFetch<{ request: CustomRequest }>(
        `/admin/custom-requests/${request.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: updates.status ?? request.status,
            estimated_price_cents:
              updates.estimated_price_cents === undefined
                ? request.estimated_price_cents
                : updates.estimated_price_cents,
            quote_message:
              updates.quote_message === undefined ? request.quote_message : updates.quote_message,
            quoted_deadline:
              updates.quoted_deadline === undefined ? request.quoted_deadline : updates.quoted_deadline,
            quoted_weight_grams:
              updates.quoted_weight_grams === undefined
                ? request.quoted_weight_grams
                : updates.quoted_weight_grams,
            quoted_package_width_cm:
              updates.quoted_package_width_cm === undefined
                ? request.quoted_package_width_cm
                : updates.quoted_package_width_cm,
            quoted_package_height_cm:
              updates.quoted_package_height_cm === undefined
                ? request.quoted_package_height_cm
                : updates.quoted_package_height_cm,
            quoted_package_length_cm:
              updates.quoted_package_length_cm === undefined
                ? request.quoted_package_length_cm
                : updates.quoted_package_length_cm,
            admin_notes: updates.admin_notes === undefined ? request.admin_notes : updates.admin_notes
          })
        }
      );

      setRequests((current) =>
        current.map((item) => (item.id === request.id ? response.request : item))
      );
      setMessage(`Orcamento ${request.code} atualizado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="admin-panel admin-management-panel">
      <div className="admin-management-header">
        <div>
          <h2>Solicitacoes recebidas</h2>
          <p>Ideias fora do catalogo para Lucas avaliar, orcar e converter em pedido.</p>
        </div>
      </div>

      <div className="catalog-toolbar compact-toolbar">
        <label>
          Buscar
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cliente, codigo ou ideia"
            value={query}
          />
        </label>
        <label>
          Status
          <select
            onChange={(event) => setStatus(event.target.value as CustomRequestStatus)}
            value={status}
          >
            {customRequestStatuses.map((item) => (
              <option key={item} value={item}>
                {item === "todos" ? "Todos" : statusLabels[item]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message ? <p className="form-note">{message}</p> : null}
      {isLoading ? <p>Carregando orcamentos...</p> : null}

      <div className="admin-order-summary-strip">
        <span>{filteredRequests.length} orcamento(s) na visao atual</span>
        <strong>
          {formatMoneyBRL(
            filteredRequests.reduce(
              (total, request) => total + (request.estimated_price_cents ?? 0),
              0
            )
          )}
        </strong>
      </div>

      <div className="admin-order-list">
        {filteredRequests.map((request) => {
          const isExpanded = expandedRequestId === request.id;
          const phoneHref = request.customer_phone ? getBrazilianPhoneHref(request.customer_phone) : null;
          const whatsappHref = request.customer_phone
            ? getBrazilianWhatsAppHref(request.customer_phone)
            : null;

          return (
            <article className="admin-order-card" data-expanded={isExpanded} key={request.id}>
              <button
                aria-controls={`custom-request-details-${request.id}`}
                aria-expanded={isExpanded}
                className="admin-order-summary-button"
                onClick={() => setExpandedRequestId(isExpanded ? null : request.id)}
                type="button"
              >
                <span className="admin-order-summary-main">
                  <strong>{request.code}</strong>
                  <span>
                    {request.customer_name} - {request.customer_contact}
                  </span>
                  {request.customer_phone ? <small>{request.customer_phone}</small> : null}
                  <small>{getRequestSummary(request)}</small>
                </span>
                <span className="admin-order-summary-meta">
                  <strong>
                    {request.estimated_price_cents
                      ? formatMoneyBRL(request.estimated_price_cents)
                      : "Sem preco"}
                  </strong>
                  <span>{new Intl.DateTimeFormat("pt-BR").format(new Date(request.created_at))}</span>
                  <span className="admin-order-summary-status">
                    <span className="status-pill">{statusLabels[request.status]}</span>
                  </span>
                </span>
                <span className="admin-order-expand-copy">
                  {isExpanded ? (
                    <ChevronUp aria-hidden="true" size={18} />
                  ) : (
                    <ChevronDown aria-hidden="true" size={18} />
                  )}
                  {isExpanded ? "Minimizar" : "Ver detalhes"}
                </span>
              </button>

              {isExpanded ? (
                <div
                  className="admin-order-expanded-content"
                  id={`custom-request-details-${request.id}`}
                >
                  <div className="admin-contact-actions">
                    {request.customer_email ? (
                      <a className="text-link" href={`mailto:${request.customer_email}`}>
                        <Mail aria-hidden="true" size={16} />
                        E-mail
                      </a>
                    ) : null}
                    {phoneHref ? (
                      <a className="text-link" href={phoneHref}>
                        <Phone aria-hidden="true" size={16} />
                        Ligar
                      </a>
                    ) : null}
                    {whatsappHref ? (
                      <a className="text-link" href={whatsappHref} rel="noreferrer" target="_blank">
                        <MessageCircle aria-hidden="true" size={16} />
                        WhatsApp
                      </a>
                    ) : null}
                  </div>

                  <div className="order-items-list">
                    <div>
                      <strong>{request.title}</strong>
                      <span>Qtd. {request.quantity}</span>
                      <small>{request.description}</small>
                      {request.desired_material ? <small>Material: {request.desired_material}</small> : null}
                      {request.desired_colors ? <small>Cores: {request.desired_colors}</small> : null}
                      {request.deadline ? <small>Prazo desejado: {request.deadline}</small> : null}
                      {request.quoted_deadline ? (
                        <small>Prazo informado ao cliente: {request.quoted_deadline}</small>
                      ) : null}
                      {getPackageSummary(request) ? (
                        <small>Pacote: {getPackageSummary(request)}</small>
                      ) : null}
                      {request.reference_url ? (
                        <small>
                          <a className="text-link" href={request.reference_url} rel="noreferrer" target="_blank">
                            Referencia <ExternalLink aria-hidden="true" size={14} />
                          </a>
                        </small>
                      ) : null}
                    </div>
                  </div>

                  <div className="form-grid">
                    <label>
                      Status
                      <select
                        onChange={(event) =>
                          void updateRequest(request, {
                            status: event.target.value as CustomRequest["status"]
                          })
                        }
                        value={request.status}
                      >
                        {customRequestStatuses
                          .filter((item) => item !== "todos")
                          .map((item) => (
                            <option key={item} value={item}>
                              {statusLabels[item]}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Preco estimado
                      <input
                        defaultValue={
                          request.estimated_price_cents
                            ? (request.estimated_price_cents / 100).toFixed(2).replace(".", ",")
                            : ""
                        }
                        inputMode="decimal"
                        onBlur={(event) =>
                          void updateRequest(request, {
                            estimated_price_cents: parsePriceToCents(event.target.value)
                          })
                        }
                        placeholder="120,00"
                      />
                    </label>
                    <label>
                      Prazo informado ao cliente
                      <input
                        defaultValue={request.quoted_deadline ?? ""}
                        onBlur={(event) =>
                          void updateRequest(request, { quoted_deadline: event.target.value || null })
                        }
                        placeholder="Ex.: 3 dias uteis apos o pagamento"
                      />
                    </label>
                    <label>
                      Peso para envio (g)
                      <input
                        defaultValue={request.quoted_weight_grams ?? ""}
                        inputMode="numeric"
                        onBlur={(event) =>
                          void updateRequest(request, {
                            quoted_weight_grams: event.target.value ? Number(event.target.value) : null
                          })
                        }
                        placeholder="250"
                      />
                    </label>
                    <label>
                      Largura pacote (cm)
                      <input
                        defaultValue={request.quoted_package_width_cm ?? ""}
                        inputMode="decimal"
                        onBlur={(event) =>
                          void updateRequest(request, {
                            quoted_package_width_cm: parseNullableNumber(event.target.value)
                          })
                        }
                        placeholder="16"
                      />
                    </label>
                    <label>
                      Altura pacote (cm)
                      <input
                        defaultValue={request.quoted_package_height_cm ?? ""}
                        inputMode="decimal"
                        onBlur={(event) =>
                          void updateRequest(request, {
                            quoted_package_height_cm: parseNullableNumber(event.target.value)
                          })
                        }
                        placeholder="8"
                      />
                    </label>
                    <label>
                      Comprimento pacote (cm)
                      <input
                        defaultValue={request.quoted_package_length_cm ?? ""}
                        inputMode="decimal"
                        onBlur={(event) =>
                          void updateRequest(request, {
                            quoted_package_length_cm: parseNullableNumber(event.target.value)
                          })
                        }
                        placeholder="20"
                      />
                    </label>
                  </div>

                  <label>
                    Mensagem para o cliente
                    <textarea
                      defaultValue={request.quote_message ?? ""}
                      onBlur={(event) => void updateRequest(request, { quote_message: event.target.value })}
                      placeholder="Ex.: Consigo produzir essa peca em PLA preto. O valor inclui acabamento e prazo estimado de 3 dias uteis apos o pagamento."
                      rows={4}
                    />
                  </label>

                  <label>
                    Notas internas
                    <textarea
                      defaultValue={request.admin_notes ?? ""}
                      onBlur={(event) => void updateRequest(request, { admin_notes: event.target.value })}
                      placeholder="Observacoes visiveis apenas no painel administrativo."
                      rows={3}
                    />
                  </label>

                  {savingId === request.id ? <span className="saving-pill">Salvando...</span> : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!isLoading && filteredRequests.length === 0 ? (
        <div className="empty-state">
          <h2>Nenhum orcamento encontrado</h2>
          <p>Novas ideias enviadas pelo site aparecem aqui.</p>
        </div>
      ) : null}
    </section>
  );
}
