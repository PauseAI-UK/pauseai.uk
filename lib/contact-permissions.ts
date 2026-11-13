// Whether we may contact an address or a phone number about each topic, by
// each way, and why: the answer the supporter pages show, the list filters
// on and the staff home counts. The rules are contact_permission()'s
// (netlify/database/migrations/0100_consents.sql), and
// lib/server/contact-permissions.ts reads them.

/** What we'd reach someone at: an email address, or a phone number. */
export const CHANNELS = ["email", "phone"] as const;
export type Channel = (typeof CHANNELS)[number];

/** How we'd reach someone: by email, or at a number by text (WhatsApp too) or a call. */
export const WAYS = ["email", "text", "call"] as const;
export type Way = (typeof WAYS)[number];

/** The channel a way reaches someone at. */
export function channelOf(way: Way): Channel {
  return way === "email" ? "email" : "phone";
}

/** What we'd send someone: the UK newsletter, which includes events; events only; or volunteering. */
export const TOPICS = ["newsletter", "events", "volunteering"] as const;
export type Topic = (typeof TOPICS)[number];

/** A consent: a topic, by a way. */
export type Consent = { topic: Topic; way: Way };

/** The ways each topic goes by: a call only ever about volunteering, as a newsletter or an event isn't one. */
const TOPIC_WAYS = {
  newsletter: ["email", "text"],
  events: ["email", "text"],
  volunteering: ["email", "text", "call"],
} as const satisfies Record<Topic, readonly Way[]>;

/** Every consent, a topic at a time, in the order the pages show them. */
export const CONSENTS: Consent[] = TOPICS.flatMap((topic) => TOPIC_WAYS[topic].map((way) => ({ topic, way })));

/** Whether a topic goes by a way. */
export function hasWay(topic: Topic, way: Way): boolean {
  return (TOPIC_WAYS[topic] as readonly Way[]).includes(way);
}

/** A consent's key, "<way>:<topic>", as a filter's value starts and the copy names it. */
export function consentKey({ topic, way }: Consent): `${Way}:${Topic}` {
  return `${way}:${topic}`;
}

/** Our answer for an address about a consent: we'd contact them, or we wouldn't. */
export const SENDS = ["yes", "no"] as const;
export type Send = (typeof SENDS)[number];

/** Why we may or may not contact someone about a consent; the migration says what each means. */
export const REASONS = [
  "asked",
  "chose",
  "signed-up",
  "subscribed",
  "following",
  "gave-number",
  "volunteered",
  "blocked",
  "do-not-email",
  "no-bulk-email",
  "do-not-sms",
  "do-not-phone",
  "unsubscribed",
  "declined",
  "not-volunteer",
  "not-opted-in",
  "not-following",
  "left",
  "ended",
] as const;
export type Reason = (typeof REASONS)[number];

/**
 * What the Consent filter finds: an answer for one consent, any answer, yes
 * or no (`send`), or one reason.
 */
export type ContactState = Consent & { send?: Send; reason?: Reason };

/**
 * A state from its form value: "<way>:<topic>" for any answer,
 * "<way>:<topic>:<send>" for one answer, "<way>:<topic>:<reason>" for one
 * reason.
 */
export function contactState(value: string): ContactState | undefined {
  const [way, topic, last, ...rest] = value.split(":");
  if (rest.length > 0 || !(WAYS as readonly string[]).includes(way)) return undefined;
  if (!(TOPICS as readonly string[]).includes(topic)) return undefined;
  const state = { way: way as Way, topic: topic as Topic };
  if (last === undefined) return state;
  if ((SENDS as readonly string[]).includes(last)) return { ...state, send: last as Send };
  return (REASONS as readonly string[]).includes(last) ? { ...state, reason: last as Reason } : undefined;
}

/** A state's form value, which contactState reads back. */
export function stateValue(state: ContactState): string {
  return [state.way, state.topic, state.send ?? state.reason].filter(Boolean).join(":");
}

/** Whether we may contact `address` by `way` about `topic`, why, since when, and which source told us. */
export type ContactPermission = Consent & {
  channel: Channel;
  /** An email address, or a phone number as phone_number() writes it. */
  address: string;
  send: Send;
  reason: Reason;
  at: Date | null;
  /** A form, `member`, `luma`, `civicrm`, or the source of the block or opt-out. */
  source: string | null;
};
