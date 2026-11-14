import "server-only";
import { config } from "@/lib/server/config.server";
import { timingSafeEqual } from "node:crypto";
import { now } from "@/lib/now";
import { query } from "@/lib/server/db.server";
import type { DeliveryProblem } from "./email.server";

// What Postmark tells us of the emails we send: bounces and spam complaints,
// and deliveries of copies of broadcasts. Its inbound webhook, replies to
// letters, is letters' (lib/letters/inbound.server.ts). Postmark doesn't sign
// webhooks, so each webhook URL carries a username and password (basic auth,
// over HTTPS), and requests without them are refused.

/** Whether a webhook request carries our basic auth credentials. Without them set, none does. */
export function isPostmark(request: Request): boolean {
  const user = config.postmarkWebhookUser;
  const password = config.postmarkWebhookPassword;
  if (!user || !password) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Postmark's bounce and spam complaint webhooks' payloads, as far as we read them. */
export type PostmarkProblem = {
  RecordType?: string;
  /** The bounce's own ID. */
  ID?: number;
  MessageID?: string;
  Type?: string;
  Description?: string;
  Email?: string;
  /** Whether Postmark suppressed the address because of it. */
  Inactive?: boolean;
  /** Whether Postmark would send to it again if asked. */
  CanActivate?: boolean;
};

/**
 * Whether a bounce is an automatic reply, such as an out-of-office, sent to
 * the email's bounce address (Return-Path) rather than its From.
 */
export function isAutoResponder(payload: PostmarkProblem): boolean {
  return payload.RecordType === "Bounce" && payload.Type === "AutoResponder";
}

/**
 * A bounce or complaint in Postmark's words, as any provider's: hard when
 * Postmark suppressed the address, else soft. Undefined for anything else,
 * an automatic reply included: the email was delivered.
 */
export function deliveryProblem(payload: PostmarkProblem): DeliveryProblem | undefined {
  const kind =
    payload.RecordType === "SpamComplaint"
      ? "complaint"
      : payload.RecordType === "Bounce" && !isAutoResponder(payload)
        ? payload.Inactive
          ? "hard"
          : "soft"
        : undefined;
  if (!kind || !payload.Email) return undefined;
  return {
    address: payload.Email,
    messageId: payload.MessageID ?? null,
    kind,
    reason: payload.Description ?? "",
    canReset: payload.CanActivate === true,
    details: { type: payload.Type },
  };
}

/** Postmark's delivery webhook's payload, as far as we read it. */
export type PostmarkDelivery = { RecordType?: string; MessageID?: string; DeliveredAt?: string };

/**
 * Marks a copy of a broadcast delivered, once, from Postmark's delivery
 * webhook, which the broadcast stream has. Returns whether it was a delivery,
 * whatever it was of.
 */
export async function recordDelivery(payload: PostmarkDelivery): Promise<boolean> {
  if (payload.RecordType !== "Delivery") return false;
  const at = payload.DeliveredAt && !Number.isNaN(Date.parse(payload.DeliveredAt)) ? payload.DeliveredAt : now();
  await query(
    `WITH copy AS (
       UPDATE broadcast_messages SET status = 'delivered' WHERE provider_message_id = $1 AND status = 'sent' RETURNING id)
     INSERT INTO broadcast_message_events (message_id, kind, at) SELECT id, 'delivered', $2 FROM copy`,
    [payload.MessageID ?? null, at],
  );
  return true;
}
