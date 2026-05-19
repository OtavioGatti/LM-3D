import { formatMoneyBRL } from "@lm-3d/shared";
import { env } from "../config/env.js";

type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type OrderItem = {
  quantity: number;
  unit_price_cents: number;
  product_snapshot: unknown;
};

export type OrderEmailData = {
  code: string;
  customer_name: string;
  total_cents: number;
  tracking_code?: string | null;
  order_items?: OrderItem[];
};

export type CustomRequestEmailData = {
  code: string;
  customer_name: string;
  title: string;
  estimated_price_cents?: number | null;
  quote_message?: string | null;
  quoted_deadline?: string | null;
};

function appUrl(path: string) {
  return `${env.APP_PUBLIC_URL.replace(/\/+$/, "")}${path}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getSnapshotName(snapshot: unknown) {
  const record = asRecord(snapshot);
  const name = typeof record?.name === "string" ? record.name.trim() : "";

  return name || "Produto LM-3D";
}

function baseLayout({
  title,
  preview,
  children
}: {
  title: string;
  preview: string;
  children: string;
}) {
  const accountUrl = appUrl("/conta");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f4f1eb;color:#0d241c;font-family:Arial,Helvetica,sans-serif;">
    <span style="display:none;opacity:0;visibility:hidden;">${escapeHtml(preview)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1eb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffefb;border:1px solid #d8e0d8;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #d8e0d8;">
                <strong style="font-size:18px;letter-spacing:.02em;">LM-3D</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#08251a;">${escapeHtml(title)}</h1>
                ${children}
                <p style="margin:28px 0 0;">
                  <a href="${accountUrl}" style="display:inline-block;background:#07885f;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:999px;">Acompanhar em Minha conta</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#eef6f1;color:#52645b;font-size:13px;line-height:1.5;">
                Este e um e-mail automatico sobre seu pedido/orcamento na LM-3D.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function paragraph(value: string) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#365247;">${escapeHtml(value)}</p>`;
}

function detailLine(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;color:#61736a;font-size:14px;">${escapeHtml(label)}</td>
    <td align="right" style="padding:8px 0;color:#0d241c;font-size:14px;font-weight:700;">${escapeHtml(value)}</td>
  </tr>`;
}

function orderItems(items: OrderItem[] | undefined) {
  if (!items?.length) {
    return "";
  }

  const rows = items
    .map((item) => {
      const name = getSnapshotName(item.product_snapshot);

      return `<li style="margin:0 0 6px;">${item.quantity}x ${escapeHtml(name)} - ${escapeHtml(
        formatMoneyBRL(item.unit_price_cents)
      )}</li>`;
    })
    .join("");

  return `<ul style="margin:10px 0 16px;padding-left:20px;color:#365247;font-size:14px;line-height:1.5;">${rows}</ul>`;
}

export function quoteReadyTemplate(request: CustomRequestEmailData): EmailTemplate {
  const price = request.estimated_price_cents
    ? formatMoneyBRL(request.estimated_price_cents)
    : "A conferir em Minha conta";
  const deadline = request.quoted_deadline || "Prazo informado no orçamento";
  const message = request.quote_message?.trim();
  const title = `Seu orçamento ${request.code} foi respondido`;
  const intro = `Oi, ${request.customer_name}. O orçamento do seu pedido personalizado ja esta pronto.`;
  const children = [
    paragraph(intro),
    message ? paragraph(message) : "",
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-top:1px solid #d8e0d8;border-bottom:1px solid #d8e0d8;">`,
    detailLine("Pedido", request.title),
    detailLine("Valor estimado", price),
    detailLine("Prazo informado", deadline),
    `</table>`,
    paragraph("Para seguir, entre em Minha conta, escolha a entrega e finalize o pagamento com Mercado Pago.")
  ].join("");

  return {
    subject: title,
    html: baseLayout({
      title,
      preview: `Orçamento ${request.code} respondido.`,
      children
    }),
    text: [
      intro,
      message ?? "",
      `Pedido: ${request.title}`,
      `Valor estimado: ${price}`,
      `Prazo informado: ${deadline}`,
      `Acompanhe em: ${appUrl("/conta")}`
    ]
      .filter(Boolean)
      .join("\n")
  };
}

export function paymentApprovedTemplate(order: OrderEmailData): EmailTemplate {
  const title = `Pagamento confirmado: ${order.code}`;
  const intro = `Oi, ${order.customer_name}. Recebemos a confirmação do pagamento do seu pedido.`;
  const children = [
    paragraph(intro),
    orderItems(order.order_items),
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-top:1px solid #d8e0d8;border-bottom:1px solid #d8e0d8;">`,
    detailLine("Pedido", order.code),
    detailLine("Total", formatMoneyBRL(order.total_cents)),
    detailLine("Proximo passo", "Produção e preparo"),
    `</table>`,
    paragraph("Agora vamos preparar tudo por aqui. Voce pode acompanhar a evolução do pedido em Minha conta.")
  ].join("");

  return {
    subject: title,
    html: baseLayout({
      title,
      preview: `Pagamento aprovado para o pedido ${order.code}.`,
      children
    }),
    text: [
      intro,
      `Pedido: ${order.code}`,
      `Total: ${formatMoneyBRL(order.total_cents)}`,
      `Acompanhe em: ${appUrl("/conta")}`
    ].join("\n")
  };
}

export function trackingAvailableTemplate(order: OrderEmailData): EmailTemplate {
  const trackingCode = order.tracking_code?.trim() || "";
  const title = `Seu pedido ${order.code} foi enviado`;
  const intro = `Oi, ${order.customer_name}. Seu pedido ja foi enviado e o rastreio esta disponivel.`;
  const children = [
    paragraph(intro),
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-top:1px solid #d8e0d8;border-bottom:1px solid #d8e0d8;">`,
    detailLine("Pedido", order.code),
    detailLine("Codigo de rastreio", trackingCode),
    `</table>`,
    paragraph("Use o codigo acima para acompanhar a entrega pela transportadora ou pelo Melhor Rastreio.")
  ].join("");

  return {
    subject: title,
    html: baseLayout({
      title,
      preview: `Rastreio disponivel para o pedido ${order.code}.`,
      children
    }),
    text: [
      intro,
      `Pedido: ${order.code}`,
      `Codigo de rastreio: ${trackingCode}`,
      `Acompanhe em: ${appUrl("/conta")}`
    ].join("\n")
  };
}
