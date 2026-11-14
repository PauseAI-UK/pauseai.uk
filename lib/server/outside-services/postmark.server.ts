import "server-only";
import { config } from "@/lib/server/config.server";
import { randomUUID } from "node:crypto";
import { saveToOutbox } from "@/lib/server/fixtures/outbox";
import { outsideFetch } from "./outside-fetch.server";
import { readJsonIfAny } from "../json.server";

// The only file that talks to Postmark, over its HTTP API through
// outsideFetch. Not the postmark npm package: it makes its own requests,
// which would skip the fixtures in a Playwright build (docs/testing.md).

const SEND_URL = "https://api.postmarkapp.com/email";
/**
 * Postmark's streams, by what we call them: the transactional one, which
 * every email but a broadcast's copies is sent on; and the broadcast one,
 * for copies of broadcasts to supporters, which Postmark keeps apart, so
 * their complaints can't harm our letters' delivery
 * (https://postmarkapp.com/message-streams).
 */
const STREAMS = { transactional: "outbound", broadcast: "broadcast" } as const;
export type PostmarkStream = keyof typeof STREAMS;
const unsuppressUrl = (stream: string) => `https://api.postmarkapp.com/message-streams/${stream}/suppressions/delete`;
/**
 * Whether Postmark's answer says there's no such stream: 404 for an entity
 * that isn't there, or 422 with its error 1226, "The message stream for the
 * provided ID was not found" (https://postmarkapp.com/developer/api/overview).
 * Its docs don't say which a stream's suppressions give, so either is
 * taken; a 422 for anything else isn't.
 */
async function noSuchStream(res: Response): Promise<boolean> {
  if (res.status === 404) return true;
  if (res.status !== 422) return false;
  const body = ((await readJsonIfAny(res)) ?? {}) as Record<string, unknown>;
  return body.ErrorCode === 1226;
}
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
  constructor(
    message: string,
    code?: number,
    /** The HTTP status Postmark answered with, if it answered. */
    readonly status?: number,
  ) {
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
 * Sends one email, on the transactional stream unless `stream` says the
 * broadcast one. Returns Postmark's MessageID.
 *
 * Emails that aren't really sent go to the outbox (lib/server/fixtures/outbox.ts)
 * instead, and the server log says which file: with DATA_FIXTURES=1, and in
 * the dev server without a real Postmark token. The outbox is OUTBOX_DIR, or
 * tmp/outbox in the dev server.
 */
export async function sendEmail(email: Email, stream: PostmarkStream = "transactional"): Promise<string> {
  const what = `Email${email.Tag ? ` "${email.Tag}"` : ""} to an address at ${email.To.replace(/^.*@|>$/g, "")}`;
  const body = { ...email, MessageStream: STREAMS[stream] };
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
      res.status,
    );
  }
  log(
    unsent
      ? `${what}: not sent, as ${unsent}. ${fixtures ? saved() : ""}`.trim()
      : `${what}: sent through Postmark, MessageID ${result.MessageID}`,
  );
  return result.MessageID;
}

/**
 * Takes an address off both streams' suppression lists, so Postmark sends
 * to it again, as our block is one for every email. Postmark won't for a
 * spam complaint, and says so only in its
 * answer, which is ignored: if it still refuses, the next email learns that.
 * Throws if Postmark refuses, but for a broadcast stream the server doesn't
 * have (noSuchStream): nothing is suppressed on a stream that isn't there, and
 * unblocking mustn't wait for one to be made.
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
  for (const stream of Object.values(STREAMS)) {
    const res = await outsideFetch(unsuppressUrl(stream), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token || "fixture",
      },
      body: JSON.stringify({ Suppressions: [{ EmailAddress: address }] }),
    });
    if (!res.ok && !(stream === STREAMS.broadcast && (await noSuchStream(res)))) {
      throw new PostmarkError(`Postmark refused to unsuppress the address: ${res.status}`);
    }
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
