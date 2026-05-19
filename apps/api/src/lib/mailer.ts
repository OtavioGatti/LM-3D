import nodemailer from "nodemailer";
import { env } from "../config/env.js";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let transporter: nodemailer.Transporter | null = null;

function enabled(value: string) {
  return !["false", "0", "no", "off"].includes(value.trim().toLowerCase());
}

export function isEmailConfigured() {
  return (
    enabled(env.EMAIL_NOTIFICATIONS_ENABLED) &&
    Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM_EMAIL)
  );
}

function isSecureSmtp() {
  return ["true", "1", "yes", "on"].includes(env.SMTP_SECURE.trim().toLowerCase());
}

function getTransporter() {
  if (!isEmailConfigured()) {
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

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const smtp = getTransporter();

  if (!smtp) {
    throw new Error("SMTP nao configurado para envio de e-mails transacionais.");
  }

  return smtp.sendMail({
    from: {
      name: env.SMTP_FROM_NAME,
      address: env.SMTP_FROM_EMAIL || env.SMTP_USER || ""
    },
    replyTo: env.SMTP_REPLY_TO || undefined,
    to,
    subject,
    html,
    text
  });
}
