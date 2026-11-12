import { contactState, type Topic } from "./contact-permissions";
import { staffCopy } from "./content/staff-interface";
import { greetingLetter, inlinesOf, isBlankMailing, type MailingDoc, type MailingRecipientValues } from "./mailing-doc";
import { now } from "./now";
import { phoneWords } from "./phone";
import { staffDate } from "./staff-time";
import { anyAndNone, valuesOf, type ParamValue } from "./list-params";

// The rules of broadcasts to supporters, for the server to keep and the pages
// to say: how the Consent filter fixes a broadcast's channel and topic, its
// merge fields, what it costs, and what stops it being scheduled.

/** How a broadcast goes. Staff choose text, never the backend that sends it. */
export type BroadcastChannel = "email" | "text";

/**
 * What a broadcast is, fixed when it's made: its channel and its topic; or,
 * `alsoEvents`, the newsletter's and events' yeses both, for a broadcast
 * about our events, which suits either.
 */
export type BroadcastTerms = { channel: BroadcastChannel; topic: Topic; alsoEvents?: boolean };

/** The topics whose yes a broadcast goes under. */
export function broadcastTopics(terms: BroadcastTerms): Topic[] {
  return terms.alsoEvents ? ["newsletter", "events"] : [terms.topic];
}

/** A new email's words: the greeting to their first name, a line to write on, and the signature. */
export const BROADCAST_START: MailingDoc = greetingLetter(
  staffCopy.broadcastPages.greeting,
  "firstName",
  staffCopy.broadcastPages.signature,
);

/**
 * Whether a broadcast has words of its own: a subject, a template chosen, or
 * words that aren't a new email's start. Until it has, its Consent can move
 * to the other channel, as nothing written is lost.
 */
export function hasWords(broadcast: { subject: string; body: MailingDoc; templateId: number | null }): boolean {
  return (
    Boolean(broadcast.subject.trim()) ||
    broadcast.templateId !== null ||
    (!isBlankMailing(broadcast.body) && JSON.stringify(broadcast.body) !== JSON.stringify(BROADCAST_START))
  );
}

/**
 * A broadcast's channel and topic, from the supporters list's Consent filter:
 * one topic by email or text, answered yes; or the newsletter and events
 * both, by the same one, which must be about our events. Undefined for
 * anything else, as two other topics wouldn't suit both, and calls aren't
 * broadcast. What the filter leaves out doesn't count.
 */
export function broadcastTerms(contact: ParamValue | undefined): BroadcastTerms | undefined {
  const [found] = anyAndNone(valuesOf(contact), (values) => values.flatMap((value) => contactState(value) ?? []));
  if (!found?.length || found.length > 2) return undefined;
  const [{ way, topic, send }] = found;
  if (found.some((state) => state.send !== "yes" || state.way !== way) || send !== "yes" || way === "call") {
    return undefined;
  }
  if (found.length === 1) return { channel: way, topic };
  const topics = found.map((state) => state.topic).sort();
  return topics.join() === "events,newsletter" ? { channel: way, topic: "newsletter", alsoEvents: true } : undefined;
}

/** The Consent filter's values for a broadcast's terms, which broadcastTerms reads back. */
export function termsValues(terms: BroadcastTerms): string[] {
  return broadcastTopics(terms).map((topic) => `${terms.channel === "email" ? "email" : "text"}:${topic}:yes`);
}

/** A broadcast's terms as one choice in the writer, its Consent filter's values with a space between. */
export function consentChoice(terms: BroadcastTerms): string {
  return termsValues(terms).join(" ");
}

/** The terms of a choice in the writer, as consentChoice writes it. */
export function choiceTerms(choice: string): BroadcastTerms | undefined {
  return broadcastTerms(choice.split(" "));
}

/** How long after its time a broadcast waits for CiviCRM before it stops: for every broadcast, set by nobody. */
const WAIT_DAYS = 3;

/** When a broadcast that's waiting stops: WAIT_DAYS after its time. */
export function stopsAt(dueAt: Date): Date {
  return new Date(new Date(dueAt).getTime() + WAIT_DAYS * 24 * 60 * 60 * 1000);
}

/** The merge fields of a broadcast to supporters. No one has all of them, so each has a fallback. */
export const BROADCAST_FIELDS = ["firstName", "name"] as const;

/** Each merge field's words, as a template's row and a title say it. */
export const FIELD_WORDS: Record<string, string> = staffCopy.broadcastPages.fieldWords;

/** A broadcast's merge fields filled in with their own words, `{first name}`, to show its words for everyone. */
export const FIELDS_AS_WORDS: MailingRecipientValues = {
  values: Object.fromEntries(BROADCAST_FIELDS.map((field) => [field, `{${FIELD_WORDS[field]}}`])),
  meets: [],
};

/** Titles people put before their name, without a full stop: "Dr Jane Smith" has no first name we can use. */
const TITLES = new Set([
  "mr",
  "mrs",
  "ms",
  "miss",
  "mx",
  "dr",
  "prof",
  "professor",
  "sir",
  "rev",
  "revd",
  "reverend",
  "lord",
  "lady",
  "dame",
  "cllr",
  "councillor",
]);

/** One letter or several, each but perhaps the last with a full stop: "J", "J." or "J.R.". */
const INITIALS = /^(\p{L}\.)*\p{L}\.?$/u;

/** A word in one case, as "jane" or "JANE" is: it has letters, and none in the other case. */
function allOneCase(word: string): boolean {
  const lower = word.toLowerCase();
  const upper = word.toUpperCase();
  return lower !== upper && (word === lower || word === upper);
}

/** Each part of a word with its first letter a capital and the rest small, between hyphens and apostrophes: "jean-luc" is "Jean-Luc". */
function capitalised(word: string): string {
  return word
    .split(/([-'’])/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/** Words that make a name an organisation's or a household's, not a person's: "Example Events", "The Smiths". */
const NOT_A_PERSON = new Set([
  "the",
  "events",
  "group",
  "team",
  "society",
  "network",
  "club",
  "association",
  "committee",
  "foundation",
  "institute",
  "university",
  "ltd",
  "limited",
  "inc",
  "pauseai",
]);

/** Two letters with no vowel, as "bd" and "xz" are: initials, typed without full stops. */
const NO_VOWEL_PAIR = /^[b-df-hj-np-tv-xz]{2}$/i;

/**
 * Someone's first name, from the whole name they gave: its first word, in
 * capitals and small letters as a name is written when they typed it all
 * one case ("jane", "JANE"), and as they typed it otherwise ("McKenzie").
 * None, so they get the fallback rather than "Hi Dr", when there's no name;
 * when it's an organisation's or a household's ("The Smiths", "Example
 * Events"); when the name looks like an address or a username: it has an @, an
 * underscore or a digit, or it's one word with a capital after a small
 * letter inside it ("JaneTheGreat"); when the first word has no letter,
 * or anything but letters, hyphens, apostrophes and full stops; or when
 * it's a title or initials: "Dr", "J.R.", two capitals ("AB") or two
 * letters with no vowel ("bd").
 */
export function firstNameOf(name: string | null | undefined): string | undefined {
  const whole = name?.trim();
  if (!whole || /[@_\d]/.test(whole)) return undefined;
  const words = whole.split(/\s+/);
  if (words.some((word) => NOT_A_PERSON.has(word.toLowerCase()))) return undefined;
  const first = words[0];
  if (!/\p{L}/u.test(first) || /[^\p{L}\p{M}'’.-]/u.test(first)) return undefined;
  if (words.length === 1 && /\p{Ll}\p{Lu}/u.test(first)) return undefined;
  const initials = INITIALS.test(first) || /^\p{Lu}{2}$/u.test(first) || NO_VOWEL_PAIR.test(first);
  if (initials || TITLES.has(first.replace(/\.$/, "").toLowerCase())) return undefined;
  return allOneCase(first) ? capitalised(first) : first;
}

/** The condition that someone has a value for a field. */
export function hasField(field: string): string {
  return `has:${field}`;
}

/** Someone made up, as a preview shows and a test copy is filled in for: no real supporter's details. */
const FAKE = {
  name: "Jane Smith",
  email: "jane.smith@example.com",
  phone: "+447700900123",
  values: { firstName: "Jane", name: "Jane Smith" },
};

/** A made-up recipient to preview a broadcast for, and fill a test copy in for. */
export type FakeRecipient = MailingRecipientValues & { name: string; address: string };

/**
 * A made-up recipient meeting just `meets`: each field theirs where they
 * have it, its fallback where they don't, so any mix of fields and
 * conditions can be shown, and nobody's real details are.
 */
export function fakeRecipient(meets: string[], channel: BroadcastChannel): FakeRecipient {
  return {
    name: FAKE.name,
    address: channel === "email" ? FAKE.email : FAKE.phone,
    values: Object.fromEntries(
      BROADCAST_FIELDS.map((field) => [
        field,
        meets.includes(hasField(field)) ? FAKE.values[field] : staffCopy.broadcastPages.fallbacks[field],
      ]),
    ),
    meets,
  };
}

/** The condition that someone wrote to their MP in campaign `slug`. */
export function wroteIn(slug: string): string {
  return `wrote:${slug}`;
}

/** The condition that someone registered for Luma event `id`, past or to come, as the Event filter counts it: not declined. */
export function registeredFor(id: string): string {
  return `event:${id}`;
}

/** Who an email to supporters appears from, unless a connected Gmail is chosen. */
export const BROADCAST_SENDER = { name: "PauseAI UK", email: "hello@pauseai.uk" };

/** The name a text appears from: the WhatsApp business account's. */
export const TEXT_SENDER_NAME = "PauseAI UK";

/** Who a text is from, on one line: the name, then its number in brackets. */
export function textSender(name: string, number: string): string {
  return `${name} (${phoneWords(number)})`;
}

/**
 * What a text costs when delivered, in pence: a marketing message to the UK,
 * £0.0458 on Meta's GBP rate card effective 1 October 2026, checked 9
 * November 2026 (the rate cards are linked from
 * https://developers.facebook.com/docs/whatsapp/pricing#rate-cards-and-volume-tiers).
 * Meta may change it on the first of any quarter.
 */
const TEXT_PENCE_EACH = 4.58;

/** When that rate came in, said beside it, as it may have changed since. */
const TEXT_RATE_FROM = new Date("2026-10-01");

/** What `n` texts cost, in words, and the rate it's worked out at and since when. An email's few pennies go unsaid. */
export function textCost(n: number): { about: string; rate: string } {
  const copy = staffCopy.broadcastPages.cost;
  return {
    about: copy.text(((n * TEXT_PENCE_EACH) / 100).toFixed(2)),
    rate: copy.textRate(TEXT_PENCE_EACH, staffDate(TEXT_RATE_FROM)),
  };
}

/** The most of a broadcast's words its title and a template's row say. */
const FIRST_WORDS = 80;

/** A broadcast's words on one line, its merge fields each as `{label}`. */
function wordsOf(doc: MailingDoc, labels: Record<string, string>): string {
  return doc.content
    .flatMap((block) => [...inlinesOf(block), { type: "hardBreak" as const }])
    .map((node) => {
      if (node.type === "field") return `{${labels[node.attrs.field] ?? node.attrs.field}}`;
      return node.type === "text" ? node.text : " ";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** `words` cut to FIRST_WORDS, with "…" where they're cut. */
function cut(words: string): string {
  return words.length > FIRST_WORDS ? `${words.slice(0, FIRST_WORDS).trimEnd()}…` : words;
}

/** A broadcast's first words, its merge fields each as `{label}`, for a template's row. */
export function firstWords(doc: MailingDoc, labels: Record<string, string>): string {
  return cut(wordsOf(doc, labels));
}

export type BroadcastScheduleProblem =
  | "unknown-filter"
  | "no-recipients"
  | "no-subject"
  | "no-letter"
  | "no-template"
  | "not-approved"
  | "no-name"
  | "not-connected"
  | "no-time"
  | "time-passed"
  | "no-number"
  | "not-about-events"
  | "cannot-send";

/** A broadcast as far as scheduling it goes. */
export type SchedulingBroadcast = {
  channel: BroadcastChannel;
  subject: string;
  /** A text's, which new words are called by as a template. */
  title: string;
  body: MailingDoc;
  dueAt: Date | null;
  /** How many it goes to. */
  recipients: number;
  /** The values of its filter the site no longer knows. */
  unknown: string[];
  /** Whether it's from a staff member's Gmail, and whether that's connected. */
  byGmail: boolean;
  connected: boolean;
  /** Whether a text's words are a template WhatsApp has approved. */
  approved: boolean;
  /** Whether a WhatsApp number is configured for texts to come from. */
  numbered: boolean;
  /** Whether it's about our events, as one to the newsletter's and events' yeses both must be; true for any other. */
  aboutEvents: boolean;
  /** Whether its channel sends yet. */
  sends: boolean;
};

/** What doesn't stop a text's new words going to WhatsApp for approval: that they aren't approved yet, and its time. */
const LEFT_TILL_SCHEDULING: BroadcastScheduleProblem[] = ["not-approved", "no-time", "time-passed"];

/** What stops a text's new words going for approval: everything that stops it being scheduled but its time and the approval itself. */
export function approvalProblems(problems: BroadcastScheduleProblem[]): BroadcastScheduleProblem[] {
  return problems.filter((problem) => !LEFT_TILL_SCHEDULING.includes(problem));
}

/**
 * What stops a broadcast being scheduled: none, for one that can be. Unlike a
 * mailing to politicians, a field some recipients lack doesn't, as each has
 * a fallback. A text with no words has no template chosen yet, and one
 * with words goes only once they're a template WhatsApp has approved.
 */
export function broadcastScheduleProblems(broadcast: SchedulingBroadcast): BroadcastScheduleProblem[] {
  const blank = isBlankMailing(broadcast.body);
  const email = broadcast.channel === "email";
  // In the order of the page's sections: who it's to, what's written, who it's from, then WhatsApp's approval, then when.
  const checks: [BroadcastScheduleProblem, boolean][] = [
    ["unknown-filter", broadcast.unknown.length > 0],
    ["no-recipients", broadcast.recipients === 0],
    ["no-subject", email && !broadcast.subject.trim()],
    ["no-letter", email && blank],
    ["no-template", !email && blank],
    ["no-name", !email && !blank && !broadcast.approved && !broadcast.title.trim()],
    ["not-connected", broadcast.byGmail && !broadcast.connected],
    ["no-number", !email && !broadcast.numbered],
    ["not-about-events", !broadcast.aboutEvents],
    ["not-approved", !email && !blank && !broadcast.approved],
    ["no-time", !broadcast.dueAt],
    ["time-passed", Boolean(broadcast.dueAt) && new Date(broadcast.dueAt!) <= now()],
    ["cannot-send", !broadcast.sends],
  ];
  return checks.filter(([, fails]) => fails).map(([problem]) => problem);
}
