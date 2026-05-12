import { env } from "../config/env.js";
import { trackMelhorEnvioShipments } from "./melhor-envio.js";
import { getSupabaseAdminClient, hasSupabaseAdminConfig, type SupabaseAdminClient } from "./supabase.js";

type TrackableOrderRow = {
  id: string;
  code: string;
  tracking_code: string | null;
  shipping_melhor_envio_order_id: string | null;
  shipping_label_payload: Record<string, unknown> | null;
};

type TrackingUpdate = {
  order: TrackableOrderRow;
  trackingCode: string | null;
  trackingPayload: unknown;
};

let trackingSyncTimer: NodeJS.Timeout | null = null;
let isTrackingSyncRunning = false;

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isTrackingSyncEnabled() {
  return (
    env.NODE_ENV !== "test" &&
    env.MELHOR_ENVIO_TRACKING_SYNC_ENABLED.trim().toLowerCase() !== "false"
  );
}

function findTrackingPayload(response: unknown, melhorEnvioOrderId: string) {
  const responseRecord = asRecord(response);

  if (responseRecord?.[melhorEnvioOrderId]) {
    return responseRecord[melhorEnvioOrderId];
  }

  const possibleCollections = [
    response,
    responseRecord?.orders,
    responseRecord?.data,
    responseRecord?.results,
    responseRecord?.trackings
  ];

  for (const collection of possibleCollections) {
    if (!Array.isArray(collection)) {
      continue;
    }

    const match = collection.find((item) => {
      const itemRecord = asRecord(item);
      const ids = [
        itemRecord?.id,
        itemRecord?.order_id,
        itemRecord?.order,
        itemRecord?.shipment_id,
        itemRecord?.melhor_envio_order_id
      ].map(asString);

      return ids.includes(melhorEnvioOrderId);
    });

    if (match) {
      return match;
    }

    if (collection.length === 1) {
      return collection[0];
    }
  }

  return response;
}

function findNestedValue(value: unknown, keys: string[]): string | null {
  const record = asRecord(value);

  if (!record) {
    return null;
  }

  for (const key of keys) {
    const direct = asString(record[key]);

    if (direct) {
      return direct;
    }
  }

  for (const nestedValue of Object.values(record)) {
    if (!nestedValue || typeof nestedValue !== "object") {
      continue;
    }

    const nested = findNestedValue(nestedValue, keys);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractTrackingCode(trackingPayload: unknown, melhorEnvioOrderId: string) {
  const trackingCode = findNestedValue(trackingPayload, [
    "tracking_code",
    "trackingCode",
    "tracking_id",
    "trackingId",
    "tracking",
    "code"
  ]);

  if (trackingCode && trackingCode !== melhorEnvioOrderId) {
    return trackingCode;
  }

  const trackingId = findNestedValue(trackingPayload, ["id"]);

  return trackingId && trackingId !== melhorEnvioOrderId ? trackingId : null;
}

async function loadTrackableOrders(supabase: SupabaseAdminClient) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, code, tracking_code, shipping_melhor_envio_order_id, shipping_label_payload"
    )
    .eq("shipping_provider", "melhor_envio")
    .eq("shipping_label_status", "purchased")
    .is("tracking_code", null)
    .not("shipping_melhor_envio_order_id", "is", null)
    .order("shipping_label_purchased_at", { ascending: true, nullsFirst: false })
    .limit(env.MELHOR_ENVIO_TRACKING_SYNC_BATCH_SIZE);

  if (error) {
    if (/shipping_(melhor_envio|label)/.test(error.message)) {
      return [];
    }

    throw error;
  }

  return (data ?? []) as TrackableOrderRow[];
}

async function saveTrackingUpdates({
  supabase,
  updates
}: {
  supabase: SupabaseAdminClient;
  updates: TrackingUpdate[];
}) {
  for (const update of updates) {
    if (!update.trackingCode) {
      continue;
    }

    const { error } = await supabase
      .from("orders")
      .update({
        tracking_code: update.trackingCode,
        shipping_label_payload: {
          ...(update.order.shipping_label_payload ?? {}),
          tracking: update.trackingPayload,
          tracking_code: update.trackingCode,
          tracking_synced_at: new Date().toISOString()
        }
      })
      .eq("id", update.order.id)
      .is("tracking_code", null);

    if (error) {
      throw error;
    }
  }
}

export async function syncMelhorEnvioTrackingCodes() {
  if (!hasSupabaseAdminConfig()) {
    return {
      checked: 0,
      updated: 0,
      skipped: true
    };
  }

  const supabase = getSupabaseAdminClient();
  const orders = await loadTrackableOrders(supabase);

  if (orders.length === 0) {
    return {
      checked: 0,
      updated: 0,
      skipped: false
    };
  }

  const melhorEnvioOrderIds = orders
    .map((order) => order.shipping_melhor_envio_order_id)
    .filter((orderId): orderId is string => Boolean(orderId));
  const response = await trackMelhorEnvioShipments(melhorEnvioOrderIds);
  const updates = orders.map((order) => {
    const melhorEnvioOrderId = order.shipping_melhor_envio_order_id ?? "";
    const trackingPayload = findTrackingPayload(response, melhorEnvioOrderId);

    return {
      order,
      trackingPayload,
      trackingCode: extractTrackingCode(trackingPayload, melhorEnvioOrderId)
    };
  });

  await saveTrackingUpdates({
    supabase,
    updates
  });

  return {
    checked: orders.length,
    updated: updates.filter((update) => Boolean(update.trackingCode)).length,
    skipped: false
  };
}

export function startMelhorEnvioTrackingSyncJob() {
  if (!isTrackingSyncEnabled() || trackingSyncTimer) {
    return;
  }

  const intervalMs = env.MELHOR_ENVIO_TRACKING_SYNC_INTERVAL_MINUTES * 60 * 1000;

  async function run() {
    if (isTrackingSyncRunning) {
      return;
    }

    isTrackingSyncRunning = true;

    try {
      const result = await syncMelhorEnvioTrackingCodes();

      if (!result.skipped && result.checked > 0) {
        console.info("[melhor-envio] tracking sync finished", result);
      }
    } catch (error) {
      console.error("[melhor-envio] tracking sync failed", {
        error: error instanceof Error ? error.message : error
      });
    } finally {
      isTrackingSyncRunning = false;
    }
  }

  trackingSyncTimer = setInterval(() => {
    void run();
  }, intervalMs);

  setTimeout(() => {
    void run();
  }, 60000);
}
