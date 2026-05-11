"use client";

import { formatMoneyBRL, getBrazilianPhoneHref, getBrazilianWhatsAppHref } from "@lm-3d/shared";
import { ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";
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
  quote_message: string | null;
  admin_notes: string | null;
  created_at: string;
};

const statusLabels: Record<Exclude<CustomRequestStatus, "todos">, string> = {
  new: "Novo",
  contacted: "Contato feito",
  quoted: "Orçado",
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

export function AdminCustomRequestManager() {
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CustomRequestStatus>("todos");
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
        request.title,
        request.description
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [query, requests, status]);

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
            admin_notes: updates.admin_notes === undefined ? request.admin_notes : updates.admin_notes
          })
        }
      );

      setRequests((current) =>
        current.map((item) => (item.id === request.id ? response.request : item))
      );
      setMessage(`Orçamento ${request.code} atualizado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="admin-panel admin-management-panel">
      <div className="admin-management-header">
        <div>
          <h2>Solicitações recebidas</h2>
          <p>Ideias fora do catálogo para Lucas avaliar, orçar e converter em pedido.</p>
        </div>
      </div>

      <div className="catalog-toolbar compact-toolbar">
        <label>
          Buscar
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cliente, código ou ideia"
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
      {isLoading ? <p>Carregando orçamentos...</p> : null}

      <div className="admin-order-list">
        {filteredRequests.map((request) => (
          <article className="admin-order-card" key={request.id}>
            <div className="admin-order-card-header">
              <div>
                <strong>{request.code}</strong>
                <span>
                  {request.customer_name} · {request.customer_contact}
                </span>
                <span>{new Intl.DateTimeFormat("pt-BR").format(new Date(request.created_at))}</span>
              </div>
              <div>
                <strong>
                  {request.estimated_price_cents
                    ? formatMoneyBRL(request.estimated_price_cents)
                    : "Sem preço"}
                </strong>
                <span className="status-pill">{statusLabels[request.status]}</span>
              </div>
            </div>

            <div className="admin-contact-actions">
              {request.customer_email ? (
                <a className="text-link" href={`mailto:${request.customer_email}`}>
                  <Mail aria-hidden="true" size={16} />
                  E-mail
                </a>
              ) : null}
              {request.customer_phone && getBrazilianPhoneHref(request.customer_phone) ? (
                <a className="text-link" href={getBrazilianPhoneHref(request.customer_phone) ?? undefined}>
                  <Phone aria-hidden="true" size={16} />
                  Ligar
                </a>
              ) : null}
              {request.customer_phone && getBrazilianWhatsAppHref(request.customer_phone) ? (
                <a
                  className="text-link"
                  href={getBrazilianWhatsAppHref(request.customer_phone) ?? undefined}
                  rel="noreferrer"
                  target="_blank"
                >
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
                {request.reference_url ? (
                  <small>
                    <a className="text-link" href={request.reference_url} rel="noreferrer" target="_blank">
                      Referência <ExternalLink aria-hidden="true" size={14} />
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
                Preço estimado
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
                  placeholder="Ex.: 3 dias úteis após o pagamento"
                />
              </label>
            </div>

            <label>
              Mensagem para o cliente
              <textarea
                defaultValue={request.quote_message ?? ""}
                onBlur={(event) => void updateRequest(request, { quote_message: event.target.value })}
                placeholder="Ex.: Consigo produzir essa peça em PLA preto. O valor inclui acabamento e prazo estimado de 3 dias úteis após o pagamento."
                rows={4}
              />
            </label>

            <label>
              Notas internas
              <textarea
                defaultValue={request.admin_notes ?? ""}
                onBlur={(event) => void updateRequest(request, { admin_notes: event.target.value })}
                placeholder="Observações visíveis apenas no painel administrativo."
                rows={3}
              />
            </label>

            {savingId === request.id ? <span className="saving-pill">Salvando...</span> : null}
          </article>
        ))}
      </div>

      {!isLoading && filteredRequests.length === 0 ? (
        <div className="empty-state">
          <h2>Nenhum orçamento encontrado</h2>
          <p>Novas ideias enviadas pelo site aparecem aqui.</p>
        </div>
      ) : null}
    </section>
  );
}
