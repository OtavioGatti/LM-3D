import nodemailer from "nodemailer";
import { env } from "../config/env.js";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let transporter: nodemailer.Transporter | null = null;
let cachedGmailAccessToken: {
  token: string;
  expiresAt: number;
} | null = null;

function enabled(value: string) {
  return !["false", "0", "no", "off"].includes(value.trim().toLowerCase());
}

function getFromEmail() {
  return env.EMAIL_FROM_EMAIL || env.SMTP_FROM_EMAIL || env.SMTP_USER || "";
}

function getFromName() {
  return env.EMAIL_FROM_NAME || env.SMTP_FROM_NAME || "LM-3D";
}

function getReplyTo() {
  return env.EMAIL_REPLY_TO || env.SMTP_REPLY_TO || undefined;
}

function isSmtpConfigured() {
  return (
    Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && getFromEmail())
  );
}

function isGmailApiConfigured() {
  return Boolean(
    env.GMAIL_API_CLIENT_ID &&
      env.GMAIL_API_CLIENT_SECRET &&
      env.GMAIL_API_REFRESH_TOKEN &&
      getFromEmail()
  );
}

export function isEmailConfigured() {
  if (!enabled(env.EMAIL_NOTIFICATIONS_ENABLED)) {
    return false;
  }

  return env.EMAIL_PROVIDER === "gmail_api" ? isGmailApiConfigured() : isSmtpConfigured();
}

export function getEmailProvider() {
  return env.EMAIL_PROVIDER;
}

function isSecureSmtp() {
  return ["true", "1", "yes", "on"].includes(env.SMTP_SECURE.trim().toLowerCase());
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: isSecureSmtp(),
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  return transporter;
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(sanitizeHeader(value), "utf8").toString("base64")}?=`;
}

function formatAddress(name: string | undefined, email: string) {
  const safeEmail = sanitizeHeader(email);
  const safeName = sanitizeHeader(name ?? "");

  return safeName ? `${encodeHeader(safeName)} <${safeEmail}>` : `<${safeEmail}>`;
}

function base64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGmailAccessToken() {
  const now = Date.now();

  if (cachedGmailAccessToken && cachedGmailAccessToken.expiresAt > now + 60000) {
    return cachedGmailAccessToken.token;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: env.GMAIL_API_CLIENT_ID ?? "",
      client_secret: env.GMAIL_API_CLIENT_SECRET ?? "",
      refresh_token: env.GMAIL_API_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token"
    })
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !body?.access_token) {
    throw new Error(
      body?.error_description ||
        body?.error ||
        `Gmail API nao retornou access token (${response.status}).`
    );
  }

  cachedGmailAccessToken = {
    token: body.access_token,
    expiresAt: now + (body.expires_in ?? 3600) * 1000
  };

  return body.access_token;
}

function buildMimeMessage({ to, subject, html, text }: SendEmailInput) {
  const boundary = `lm3d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const replyTo = getReplyTo();
  const headers = [
    `From: ${formatAddress(getFromName(), getFromEmail())}`,
    `To: ${formatAddress(undefined, to)}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];

  if (replyTo) {
    headers.splice(2, 0, `Reply-To: ${formatAddress(undefined, replyTo)}`);
  }

  return [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${boundary}--`
  ].join("\r\n");
}

async function sendWithGmailApi(input: SendEmailInput) {
  if (!isGmailApiConfigured()) {
    throw new Error("Gmail API nao configurada para envio de e-mails transacionais.");
  }

  const accessToken = await getGmailAccessToken();
  const userId = encodeURIComponent(env.GMAIL_API_USER_ID || "me");
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        raw: base64Url(buildMimeMessage(input))
      })
    }
  );
  const body = (await response.json().catch(() => null)) as {
    id?: string;
    error?: {
      message?: string;
      status?: string;
    };
  } | null;

  if (!response.ok || !body?.id) {
    throw new Error(
      body?.error?.message ||
        body?.error?.status ||
        `Gmail API nao enviou a mensagem (${response.status}).`
    );
  }

  return {
    messageId: body.id
  };
}

async function sendWithSmtp({ to, subject, html, text }: SendEmailInput) {
  const smtp = getTransporter();

  if (!smtp) {
    throw new Error("SMTP nao configurado para envio de e-mails transacionais.");
  }

  return smtp.sendMail({
    from: {
      name: getFromName(),
      address: getFromEmail()
    },
    replyTo: getReplyTo(),
    to,
    subject,
    html,
    text
  });
}

export async function sendEmail(input: SendEmailInput) {
  return env.EMAIL_PROVIDER === "gmail_api" ? sendWithGmailApi(input) : sendWithSmtp(input);
}
