import { addressesIn } from "@/lib/email-parsing/addresses";
import { quotedHeaders } from "@/lib/email-parsing/quoted";

// One-off emails: threads with a politician that aren't a letter of a
// campaign or mailing. What counts as one, and who a thread's people are
// (lib/server/one-off-emails.ts keeps them).

/** The mailboxes whose threads with politicians the regular read keeps: the shared one, and Joseph's, as he's agreed. */
const KEPT_MAILBOXES: readonly string[] = ["policy@pauseai.uk", "joseph@pauseai.uk"];

/** Whether the regular read keeps an account's threads with politicians. */
export function keepsPoliticianThreads(account: string): boolean {
  return KEPT_MAILBOXES.includes(account.toLowerCase());
}

/** Parliaments' own domains: an address on one, or a subdomain of one, counts whoever it is. */
export const PARLIAMENT_DOMAINS = [
  "parliament.uk",
  "parliament.scot",
  "senedd.wales",
  "senedd.cymru",
  "niassembly.gov.uk",
] as const;

/**
 * Inboxes a body shares among its members, which forward a message to the
 * member it names: the House of Lords', which most Lords list as their only
 * address. No one's own, so never a politician's email or one of their
 * addresses, which a check constraint on each table also refuses (migration
 * 0124).
 */
const SHARED_INBOXES: readonly string[] = ["contactholmember@parliament.uk"];

/** Whether an address is a shared inbox (SHARED_INBOXES). */
export function isSharedInbox(address: string): boolean {
  return SHARED_INBOXES.includes(address.trim().toLowerCase());
}

/**
 * PauseAI's addresses besides the connected Gmails: kept by hand, as Gmail's
 * API can't tell an alias from another address.
 */
const PAUSEAI_ALIASES: readonly string[] = ["joseph@pauseai.info", "info@pauseai.info"];

/**
 * What the site knows of politicians' addresses: each they have or have had,
 * each domain of one's own, and the forms of parliament address each one's
 * name or seat makes (addressForms), with whose.
 */
export type PoliticianBook = {
  addresses: Map<string, number[]>;
  domains: Map<string, number>;
  forms: Map<string, number>;
};

const domainOf = (address: string) => address.slice(address.lastIndexOf("@") + 1);

/** Whether an address is on a parliament's domain or a subdomain of one. */
export function onParliamentDomain(address: string): boolean {
  const domain = domainOf(address);
  return PARLIAMENT_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** A politician as the book needs them to make their address forms. */
export type FormPerson = { id: number; name: string; house: string; constituency: string | null; inOffice: boolean };

/** A word's letters alone, lowercased, without accents: "Allin-Khan" is allinkhan. */
const letters = (word: string) =>
  word
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

const NAME_TITLES =
  /^(?:the|rt\.?|right|hon\.?|honourable|mr|mrs|ms|miss|mx|dr|sir|dame|prof(?:essor)?|lord|lady|baroness|viscount|viscountess|earl|countess|marquess|duke|bishop|archbishop)\.?\s+/i;

/**
 * A name's first name and the ways its surname is written in an address:
 * whole ("duncansmith") and its last word ("smith"). Undefined for a name of
 * one word once its titles and honours are gone, such as a peer's.
 */
export function nameParts(name: string): { first: string; surnames: string[] } | undefined {
  let plain = name.trim().replace(/\s+of\s+.*$/i, "");
  plain = plain.replace(/(\s+(MP|MSP|MS|MLA|KC|QC|[KGDCO]?BE|CBE|OBE|MBE|PC|FRS))+$/, "");
  while (NAME_TITLES.test(plain)) plain = plain.replace(NAME_TITLES, "");
  const words = plain.split(/\s+/).map(letters).filter(Boolean);
  if (words.length < 2) return undefined;
  return { first: words[0], surnames: [...new Set([words.slice(1).join(""), words.at(-1)!])] };
}

/**
 * The forms of parliament address each politician's name and seat make, by
 * key, each held by only one of them, as a key two share says nothing:
 *   name: first name and surname ("meghillier"), as in meg.hillier.mp@,
 *         meghilliermp@, officeofmeghilliermp@ or meg.hillier.msp@;
 *   seat: an MP's constituency ("romford"), as in romford.mp@, the office's.
 */
export function addressForms(people: FormPerson[]): Map<string, number> {
  const holders = new Map<string, Set<number>>();
  const hold = (key: string, id: number) => holders.set(key, (holders.get(key) ?? new Set()).add(id));
  for (const person of people) {
    const parts = nameParts(person.name);
    for (const surname of parts?.surnames ?? []) hold(`name:${parts!.first}${surname}`, person.id);
    if (person.house === "commons" && person.inOffice && person.constituency) {
      hold(`seat:${letters(person.constituency)}`, person.id);
    }
  }
  return new Map([...holders].filter(([, ids]) => ids.size === 1).map(([key, ids]) => [key, [...ids][0]]));
}

/** The words that mark an address as a politician's or their office's, after their name. */
const MARKS = ["mp", "msp", "ms", "mla", "casework", "office", "private", "constituency"];

/**
 * Whose a parliament address is by its form (addressForms). At parliament.uk
 * and parliament.scot a name or seat counts only with a mark (meg.hillier.mp@,
 * meghilliermp@, officeofmeghillier@, carla.denyer.casework@, romford.mp@), as
 * staff have first.last@ too; a name followed by its own seat
 * (mel.stride.centraldevon@) is marked by it. At the Senedd and the Assembly,
 * members have first.last@ alone.
 */
export function formOwner(forms: Map<string, number>, address: string): number | undefined {
  if (!onParliamentDomain(address)) return undefined;
  let marked = /(^|\.)(senedd\.(wales|cymru)|niassembly\.gov\.uk)$/.test(domainOf(address));
  let words = address
    .slice(0, address.lastIndexOf("@"))
    .split(/[._-]+/)
    .map(letters)
    .filter(Boolean);
  if (words[0]?.startsWith("officeof") && words[0].length > 8) {
    words = [words[0].slice(8), ...words.slice(1)];
    marked = true;
  }
  if (words.length > 1 && MARKS.includes(words.at(-1)!)) {
    words = words.slice(0, -1);
    marked = true;
  }
  let joined = words.join("");
  const run = words.length === 1 ? /^(.+?)(msp|mp)$/.exec(joined)?.[1] : undefined;
  if (run) {
    joined = run;
    marked = true;
  }
  const seat = words.length > 2 ? forms.get(`seat:${words.at(-1)}`) : undefined;
  if (seat !== undefined && forms.get(`name:${words.slice(0, -1).join("")}`) === seat) return seat;
  if (!marked) return undefined;
  return forms.get(`name:${joined}`) ?? forms.get(`seat:${joined}`);
}

/** The politicians an address is: one of theirs, on their own domain, or by its form at a parliament. */
export function politiciansOf(book: PoliticianBook, address: string): number[] {
  const known = book.addresses.get(address);
  if (known) return known;
  const owner = book.domains.get(domainOf(address)) ?? formOwner(book.forms, address);
  return owner === undefined ? [] : [owner];
}

/**
 * The politicians named with no address on a quoted message's lines, as
 * Outlook writes a colleague in Parliament: "HILLIER, Meg".
 */
export function politiciansNamed(book: PoliticianBook, names: string[]): number[] {
  const ids = names.flatMap((name) => {
    const [surname, given] = name.split(",").map((part) => part.trim());
    const first = letters(given?.split(/\s+/)[0] ?? "");
    const owner = first ? book.forms.get(`name:${first}${letters(surname)}`) : undefined;
    return owner === undefined ? [] : [owner];
  });
  return [...new Set(ids)];
}

/** What a message's addresses say of it: whether it counts as a thread with a politician, and whose. */
export function politiciansIn(book: PoliticianBook, addresses: string[]): { counts: boolean; people: number[] } {
  const people = [...new Set(addresses.flatMap((address) => politiciansOf(book, address)))];
  return { counts: people.length > 0 || addresses.some(onParliamentDomain), people };
}

/** The addresses in the blocks a message quotes or forwards: From, To and Cc. */
export function quotedAddresses(text: string): string[] {
  return [...new Set(quotedHeaders(text).flatMap((quote) => addressesIn(`${quote.from} ${quote.to} ${quote.cc}`)))];
}

/**
 * The names with no address in the blocks a message quotes or forwards, as
 * Outlook writes someone in the same organisation, surname in capitals first:
 * "HILLIER, Meg".
 */
export function quotedNames(text: string): string[] {
  const entries = quotedHeaders(text).flatMap((quote) => `${quote.from};${quote.to};${quote.cc}`.split(";"));
  const names = entries.flatMap((entry) => {
    const match = /^\s*"?([A-Z][A-Z' -]*[A-Z]),\s*([A-Z][\p{L}'-]+)/u.exec(entry);
    return match && !entry.includes("@") ? [`${match[1]}, ${match[2]}`] : [];
  });
  return [...new Set(names)];
}

/** Whether a politician or a parliament's address wrote after a thread's first message, given its senders in order. */
export function politicianAnswered(book: PoliticianBook, senders: string[]): boolean {
  return politiciansIn(book, senders.slice(1)).counts;
}

/** Who wrote in a thread, each once, in the order they first wrote, given its senders in order. */
export function participants(senders: { name: string; address: string }[]): string[] {
  return [...new Set(senders.map(({ name, address }) => name || address))];
}

/** Which politician each address is, leaving out one that several share, as it can't say whose. */
export function politicianAddresses(book: PoliticianBook, addresses: string[]): Record<string, number> {
  const known = addresses.map((address) => [address, politiciansOf(book, address)] as const);
  return Object.fromEntries(known.filter(([, ids]) => ids.length === 1).map(([address, [id]]) => [address, id]));
}

/** Whether an address is one of PauseAI's: a connected Gmail or an alias. */
export function isPauseaiAddress(address: string, connected: readonly string[]): boolean {
  return connected.includes(address) || PAUSEAI_ALIASES.includes(address);
}

/** Whether an address is anyone's at PauseAI, connected or not. */
export function isAtPauseai(address: string): boolean {
  return /@pauseai\.(uk|info)$/.test(address);
}

/** Whether a sender hides its thread from staff without `supporters`: neither a politician, nor on a parliament's domain, nor PauseAI's. */
export function isSomeoneElse(book: PoliticianBook, address: string, connected: readonly string[]): boolean {
  return !isPauseaiAddress(address, connected) && !politiciansIn(book, [address]).counts;
}

/**
 * Mail the site recognises as nothing a person need look at, in a shared
 * mailbox: its own forwards and sign-in codes, bounces, spam and Gmail's own
 * mail.
 */
export function isRecognisedMail(from: string, labels: readonly string[]): boolean {
  if (labels.includes("SPAM") || labels.includes("TRASH")) return true;
  return (
    /^(mailer-daemon|postmaster)@/.test(from) ||
    /@(notify\.pauseai\.uk|google\.com|accounts\.google\.com|googlegroups\.com)$/.test(from) ||
    /^noreply@/.test(from)
  );
}
