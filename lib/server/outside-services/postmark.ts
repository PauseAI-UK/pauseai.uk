import "server-only";
import { config } from "@/lib/server/config";
import { randomUUID } from "node:crypto";
import { saveToOutbox } from "@/lib/server/fixtures/outbox";
import { outsideFetch } from "./outside-fetch";
import { readJsonIfAny } from "../json";

// The only file that talks to Postmark, over its HTTP API through
// outsideFetch. Not the postmark npm package: it makes its own requests,
// which would skip the fixtures in a Playwright build (docs/testing.md).

const SEND_URL = "https://api.postmarkapp.com/email";
const BATCH_URL = "https://api.postmarkapp.com/email/batch";
/** The transactional stream, which every email but a broadcast's copies is sent on. */
const TRANSACTIONAL_STREAM = "outbound";
/**
 * The broadcast stream, for copies of broadcasts to supporters, which
 * Postmark keeps apart, so their complaints can't harm our letters' delivery
 * (https://postmarkapp.com/message-streams).
 */
const BROADCAST_STREAM = "broadcast";
/** The most emails Postmark takes in one batch. */
export const BATCH_SIZE = 500;
const unsuppressUrl = (stream: string) => `https://api.postmarkapp.com/message-streams/${stream}/suppressions/delete`;
/** Postmark's error for an address on the stream's suppression list. */
const INACTIVE_RECIPIENT = 406;
/** Postmark accepts this token, and answers as if it sent the email. */
const TEST_TOKEN = "POSTMARK_API_TEST";

export type Attachment = { Name: string; Content: string; ContentType: string };

export type Email = {
  From: string;
  To: string;
  Cc?: string;
  Bcc?: string;
  ReplyTo?: string;
  Subject: string;
  TextBody: string;
  HtmlBody?: string;
  /**
   * Which of its links Postmark sends through its own address to count the
   * clicks, in place of the server's setting: "None" leaves every link as
   * written. https://postmarkapp.com/developer/user-guide/tracking-links
   */
  TrackLinks?: "None" | "HtmlAndText" | "HtmlOnly" | "TextOnly";
  Attachments?: Attachment[];
  /** Shown in Postmark's activity log, and sent back with bounces. */
  Metadata?: Record<string, string>;
  /** Headers of its own, such as a Message-ID that replies can be matched to. */
  Headers?: { Name: string; Value: string }[];
  Tag?: string;
};

export class PostmarkError extends Error {
  /** Postmark refused because the address is suppressed: it bounced or complained before. */
  readonly inactive: boolean;
  constructor(message: string, code?: number) {
    super(message);
    this.inactive = code === INACTIVE_RECIPIENT;
  }
}

/** Letters to representatives are sent from here, and replies come back to it. */
export function lettersDomain(): string {
  return config.lettersMailDomain;
}

/** The site's other email, such as forwarded replies, is sent from here. */
export function notifyDomain(): string {
  return config.notifyMailDomain;
}

/**
 * Sends one email on the transactional stream. Returns Postmark's MessageID.
 *
 * Emails that aren't really sent go to the outbox (lib/server/fixtures/outbox.ts)
 * instead, and the server log says which file: with DATA_FIXTURES=1, and in
 * the dev server without a real Postmark token. The outbox is OUTBOX_DIR, or
 * tmp/outbox in the dev server.
 */
export async function sendEmail(email: Email): Promise<string> {
  const what = `Email${email.Tag ? ` "${email.Tag}"` : ""} to an address at ${email.To.replace(/^.*@|>$/g, "")}`;
  const body = { ...email, MessageStream: TRANSACTIONAL_STREAM };
  const dev = config.nodeEnv === "development";
  const outbox = config.outboxDir ?? (dev ? "tmp/outbox" : "");
  const fixtures = config.fixtures;
  const token = config.postmarkServerToken ?? "";
  const unsent = fixtures
    ? "DATA_FIXTURES=1"
    : !token
      ? "POSTMARK_SERVER_TOKEN isn't set"
      : token === TEST_TOKEN
        ? "POSTMARK_SERVER_TOKEN is Postmark's test token"
        : undefined;
  const saved = () =>
    outbox
      ? `Written to ${saveToOutbox(outbox, body)} instead.`
      : "There's no outbox, so it isn't saved anywhere either.";

  // The dev server, without a real token, doesn't ask Postmark at all.
  if (unsent && !fixtures && dev) {
    log(`${what}: not sent, as ${unsent}. ${saved()}`);
    return randomUUID();
  }
  if (!token && !fixtures) throw new PostmarkError("POSTMARK_SERVER_TOKEN is not set");
  const res = await outsideFetch(SEND_URL, {
    method: "POST",
    // The fixture Postmark (DATA_FIXTURES=1) doesn't check the token.
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token || "fixture",
    },
    body: JSON.stringify(body),
  });
  const result = ((await readJsonIfAny(res)) ?? {}) as Record<string, unknown>;
  if (!res.ok || result.ErrorCode !== 0 || typeof result.MessageID !== "string") {
    throw new PostmarkError(
      `Postmark refused the email: ${res.status} ${result.ErrorCode ?? ""} ${result.Message ?? ""}`.trim(),
      result.ErrorCode as number | undefined,
    );
  }
  log(
    unsent
      ? `${what}: not sent, as ${unsent}. ${fixtures ? saved() : ""}`.trim()
      : `${what}: sent through Postmark, MessageID ${result.MessageID}`,
  );
  return result.MessageID;
}

/** What Postmark did with one email of a batch: took it, or refused it, and whether for a suppressed address. */
export type BatchResult = { messageId: string } | { error: string; inactive: boolean };

/**
 * Sends up to BATCH_SIZE emails on the broadcast stream in one call
 * (https://postmarkapp.com/developer/api/email-api#send-batch-emails), and
 * gives what became of each, in their order. Throws if the call fails, so
 * none went. Not really sent where sendEmail's aren't: in the dev server
 * without a real token, they go to the outbox.
 */
export async function sendBroadcastBatch(emails: Email[]): Promise<BatchResult[]> {
  const body = emails.map((email) => ({ ...email, MessageStream: BROADCAST_STREAM }));
  const fixtures = config.fixtures;
  const token = config.postmarkServerToken ?? "";
  // The dev server, without a real token, doesn't ask Postmark at all.
  if (!fixtures && config.nodeEnv === "development" && (!token || token === TEST_TOKEN)) {
    const outbox = config.outboxDir ?? "tmp/outbox";
    for (const email of body) saveToOutbox(outbox, email);
    log(`${emails.length} broadcast emails: not sent, as there's no real POSTMARK_SERVER_TOKEN. Written to ${outbox}.`);
    return emails.map(() => ({ messageId: randomUUID() }));
  }
  if (!token && !fixtures) throw new PostmarkError("POSTMARK_SERVER_TOKEN is not set");
  const res = await outsideFetch(BATCH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token || "fixture",
    },
    body: JSON.stringify(body),
  });
  const results = await readJsonIfAny(res);
  if (!res.ok || !Array.isArray(results) || results.length !== emails.length) {
    throw new PostmarkError(`Postmark refused the batch: ${res.status} ${JSON.stringify(results)}`.slice(0, 500));
  }
  if (fixtures && config.outboxDir) for (const email of body) saveToOutbox(config.outboxDir, email);
  log(`${emails.length} broadcast emails sent through Postmark.`);
  return (results as Record<string, unknown>[]).map((result) =>
    result.ErrorCode === 0 && typeof result.MessageID === "string"
      ? { messageId: result.MessageID }
      : {
          error: `${String(result.ErrorCode)} ${String(result.Message)}`,
          inactive: result.ErrorCode === INACTIVE_RECIPIENT,
        },
  );
}

/**
 * Takes an address off both streams' suppression lists, so Postmark sends
 * to it again, as our block is one for every email. Postmark won't for a
 * spam complaint, and says so only in its
 * answer, which is ignored: if it still refuses, the next email learns that.
 * The dev server, without a real token, doesn't ask.
 */
export async function unsuppress(address: string): Promise<void> {
  const fixtures = config.fixtures;
  const token = config.postmarkServerToken ?? "";
  if (!fixtures && config.nodeEnv === "development" && (!token || token === TEST_TOKEN)) {
    log(`${address}: not taken off Postmark's suppression list, as there's no real POSTMARK_SERVER_TOKEN.`);
    return;
  }
  if (!token && !fixtures) throw new PostmarkError("POSTMARK_SERVER_TOKEN is not set");
  for (const stream of [TRANSACTIONAL_STREAM, BROADCAST_STREAM]) {
    const res = await outsideFetch(unsuppressUrl(stream), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token || "fixture",
      },
      body: JSON.stringify({ Suppressions: [{ EmailAddress: address }] }),
    });
    if (!res.ok) throw new PostmarkError(`Postmark refused to unsuppress the address: ${res.status}`);
  }
}

/** Says in the server log what happened to an email. Quiet in unit tests, which send plenty. */
function log(line: string): void {
  if (config.nodeEnv !== "test") console.info(line);
}

/** A display name that can't break out of the From header's quotes. */
export function headerName(name: string): string {
  return name.replace(/["\\\r\n<>]/g, "").trim();
}
