import type { SupabaseAdminClient } from "./supabase.js";
import { getEmailProvider, isEmailConfigured, sendEmail } from "./mailer.js";
import {
  paymentApprovedTemplate,
  quoteReadyTemplate,
  trackingAvailableTemplate,
  type CustomRequestEmailData,
  type OrderEmailData
} from "./email-templates.js";

type NotificationEntityType = "order" | "custom_request";
type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

type NotificationClaim = {
  id: string;
};

type ExistingNotification = {
  id: string;
  status: NotificationStatus;
  attempts: number | null;
};

type SendOnceInput = {
  supabase: SupabaseAdminClient;
  entityType: NotificationEntityType;
  entityId: string;
  eventType: string;
  recipientEmail: string | null | undefined;
  recipientName: string | null | undefined;
  metadata?: Record<string, unknown>;
  buildEmail: () => {
    subject: string;
    html: string;
    text: string;
  };
};

function isMissingNotificationsTable(error: unknown) {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  return /email_notifications/.test(String(error.message));
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function normalizeEmail(email: string | null | undefined) {
  const value = email?.trim().toLowerCase() ?? "";

  return value || null;
}

function getDedupeKey(entityType: NotificationEntityType, entityId: string, eventType: string) {
  return `${entityType}:${entityId}:${eventType}`;
}

async function claimNotification({
  supabase,
  entityType,
  entityId,
  eventType,
  recipientEmail,
  recipientName,
  metadata
}: Omit<SendOnceInput, "buildEmail">): Promise<NotificationClaim | null> {
  const dedupeKey = getDedupeKey(entityType, entityId, eventType);
  const notificationPayload = {
    dedupe_key: dedupeKey,
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    recipient_email: recipientEmail,
    recipient_name: recipientName ?? null,
    status: "pending",
    attempts: 1,
    metadata: metadata ?? {}
  };
  const { data, error } = await supabase
    .from("email_notifications")
    .insert(notificationPayload)
    .select("id")
    .single();

  if (!error && data) {
    return data as NotificationClaim;
  }

  if (isMissingNotificationsTable(error)) {
    console.warn("[email] tabela email_notifications ainda não existe; envio ignorado.");
    return null;
  }

  if (!isUniqueViolation(error)) {
    throw error;
  }

  const { data: existingData, error: existingError } = await supabase
    .from("email_notifications")
    .select("id, status, attempts")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  const existing = existingData as ExistingNotification | null;

  if (!existing || existing.status !== "failed" || (existing.attempts ?? 0) >= 5) {
    return null;
  }

  const { data: retryData, error: retryError } = await supabase
    .from("email_notifications")
    .update({
      status: "pending",
      attempts: (existing.attempts ?? 0) + 1,
      error_message: null,
      metadata: metadata ?? {}
    })
    .eq("id", existing.id)
    .select("id")
    .single();

  if (retryError) {
    throw retryError;
  }

  return retryData as NotificationClaim;
}

async function markNotification({
  supabase,
  notificationId,
  status,
  providerMessageId,
  errorMessage
}: {
  supabase: SupabaseAdminClient;
  notificationId: string;
  status: NotificationStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
}) {
  const { error } = await supabase
    .from("email_notifications")
    .update({
      status,
      provider: getEmailProvider(),
      provider_message_id: providerMessageId ?? null,
      error_message: errorMessage ?? null,
      sent_at: status === "sent" ? new Date().toISOString() : null
    })
    .eq("id", notificationId);

  if (error && !isMissingNotificationsTable(error)) {
    throw error;
  }
}

async function sendNotificationOnce(input: SendOnceInput) {
  const recipientEmail = normalizeEmail(input.recipientEmail);

  if (!recipientEmail) {
    return;
  }

  if (!isEmailConfigured()) {
    console.warn("[email] SMTP não configurado; envio ignorado.", {
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType
    });
    return;
  }

  try {
    const claim = await claimNotification({
      ...input,
      recipientEmail
    });

    if (!claim) {
      return;
    }

    try {
      const email = input.buildEmail();
      const result = await sendEmail({
        to: recipientEmail,
        subject: email.subject,
        html: email.html,
        text: email.text
      });

      await markNotification({
        supabase: input.supabase,
        notificationId: claim.id,
        status: "sent",
        providerMessageId: result.messageId
      });
    } catch (error) {
      await markNotification({
        supabase: input.supabase,
        notificationId: claim.id,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Erro desconhecido no envio."
      });

      console.error("[email] falha ao enviar notificacao", {
        entityType: input.entityType,
        entityId: input.entityId,
        eventType: input.eventType,
        error: error instanceof Error ? error.message : error
      });
    }
  } catch (error) {
    console.error("[email] notificação ignorada para não interromper o fluxo principal", {
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      error: error instanceof Error ? error.message : error
    });
  }
}

async function loadOrderEmailData(supabase: SupabaseAdminClient, orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
        id,
        code,
        customer_name,
        customer_email,
        total_cents,
        tracking_code,
        order_items (
          quantity,
          unit_price_cents,
          product_snapshot
        )
      `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as (OrderEmailData & { id: string; customer_email: string }) | null;
}

export async function notifyOrderPaymentApproved({
  supabase,
  orderId
}: {
  supabase: SupabaseAdminClient;
  orderId: string;
}) {
  const order = await loadOrderEmailData(supabase, orderId);

  if (!order) {
    return;
  }

  await sendNotificationOnce({
    supabase,
    entityType: "order",
    entityId: order.id,
    eventType: "order_payment_approved",
    recipientEmail: order.customer_email,
    recipientName: order.customer_name,
    metadata: {
      order_code: order.code
    },
    buildEmail: () => paymentApprovedTemplate(order)
  });
}

export async function notifyOrderTrackingAvailable({
  supabase,
  orderId
}: {
  supabase: SupabaseAdminClient;
  orderId: string;
}) {
  const order = await loadOrderEmailData(supabase, orderId);

  if (!order?.tracking_code?.trim()) {
    return;
  }

  await sendNotificationOnce({
    supabase,
    entityType: "order",
    entityId: order.id,
    eventType: "order_tracking_available",
    recipientEmail: order.customer_email,
    recipientName: order.customer_name,
    metadata: {
      order_code: order.code,
      tracking_code: order.tracking_code
    },
    buildEmail: () => trackingAvailableTemplate(order)
  });
}

export async function notifyCustomRequestQuoted({
  supabase,
  request
}: {
  supabase: SupabaseAdminClient;
  request: CustomRequestEmailData & {
    id: string;
    status: string;
    customer_email?: string | null;
  };
}) {
  if (request.status !== "quoted") {
    return;
  }

  await sendNotificationOnce({
    supabase,
    entityType: "custom_request",
    entityId: request.id,
    eventType: "custom_request_quoted",
    recipientEmail: request.customer_email,
    recipientName: request.customer_name,
    metadata: {
      request_code: request.code,
      estimated_price_cents: request.estimated_price_cents ?? null
    },
    buildEmail: () => quoteReadyTemplate(request)
  });
}
