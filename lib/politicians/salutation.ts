// A politician's salutation, the words after "Dear", made by rule from what
// their body lists: their title and surname, as each body writes them. It's
// null where the rule can't tell, as for someone whose gender isn't known
// and who has no title: their salutation is then their name, for staff to
// check (lib/politicians/import-changes.ts). Gender is only ever read to choose Mr
// or Ms here, never kept.

/** A gender as a source gives it: male, female, another, or not known. */
export type Gender = "male" | "female" | "other" | undefined;

const TITLES = ["Mr", "Mrs", "Ms", "Miss", "Mx", "Dr", "Sir", "Dame", "Professor", "Prof"] as const;

/** The title at the start of `words`, if it's one a salutation uses, and the words after it. */
function titled(words: string): { title?: string; rest: string } {
  const [first, ...rest] = words.trim().split(/\s+/);
  const title = TITLES.find((t) => t.toLowerCase() === first.replace(/\.$/, "").toLowerCase());
  return title ? { title: title === "Prof" ? "Professor" : title, rest: rest.join(" ") } : { rest: words.trim() };
}

/**
 * Title and surname: Sir and Dame take the first name ("Sir Mark"); with
 * no title, Mr or Ms by gender, Mx for another, and null if it isn't known.
 */
export function personalSalutation(
  { title, first, surname }: { title?: string; first: string; surname: string },
  gender: Gender,
): string | null {
  if (title === "Sir" || title === "Dame") return `${title} ${first}`;
  if (title) return `${title} ${surname}`;
  const by = { male: "Mr", female: "Ms", other: "Mx" } as const;
  return gender ? `${by[gender]} ${surname}` : null;
}

/** The parts of Parliament's list name for an MP ("Abbott, Ms Diane"): the surname, then any title and the first name. */
function listName(listAs: string): { title?: string; first: string; surname: string } {
  const [surname, given = ""] = listAs.split(/,\s*/);
  const { title, rest } = titled(given);
  return { title, first: rest.split(/\s+/)[0], surname: surname.trim() };
}

/** An MP's, from Parliament's list name and their gender. */
export function mpSalutation(listAs: string, gender: Gender): string | null {
  return personalSalutation(listName(listAs), gender);
}

/** Whether Parliament's list name for an MP has a title: one they have on record, so the salutation it makes is how they asked to be addressed. */
export function mpTitled(listAs: string): boolean {
  return listName(listAs).title !== undefined;
}

/** The ranks a peer is written to as Lord, and as Lady. */
const LORDS = /^(?:The\s+)?(?:Lord|Viscount|Earl|Marquess|Baron)\s+(?:of\s+)?/i;
const LADIES = /^(?:The\s+)?(?:Baroness|Lady|Viscountess|Countess|Marchioness)\s+(?:of\s+)?/i;

/**
 * A peer's, from the name Parliament displays: their rank as Lord or Lady
 * and their title's name without its place ("Baroness Smith of Basildon" is
 * Lady Smith; "The Earl of Kinnoull" is Lord Kinnoull); a bishop is Bishop,
 * an archbishop Archbishop, and a duke Duke.
 */
export function peerSalutation(displayAs: string): string | null {
  const name = displayAs.trim();
  if (/^(?:The\s+)?(?:Lord\s+)?Archbishop\b/i.test(name)) return "Archbishop";
  if (/^(?:The\s+)?(?:Lord\s+)?Bishop\b/i.test(name)) return "Bishop";
  if (/^(?:The\s+)?Duke\b/i.test(name)) return "Duke";
  const rank = LADIES.test(name) ? "Lady" : LORDS.test(name) ? "Lord" : undefined;
  if (!rank) return null;
  return `${rank} ${name.replace(rank === "Lady" ? LADIES : LORDS, "").replace(/\s+of\s+.*$/i, "")}`;
}

/** Words that join a surname to the word before it: "ap Iorwerth", "Mac Ionmhain", "van der Berg". */
const PARTICLES = new Set([
  "ap",
  "ab",
  "verch",
  "ferch",
  "de",
  "da",
  "di",
  "du",
  "del",
  "der",
  "van",
  "von",
  "le",
  "la",
  "mac",
  "ó",
  "ní",
  "nic",
  "bin",
  "al",
]);

/**
 * The surname in a name written in full ("Steve Bayliss", "Rhun ap
 * Iorwerth"): the last word, with any particles before it. A
 * double-barrelled surname written without its hyphen can't be told from
 * a middle name, so the caller passes `surname` when the source has one.
 */
export function surnameOf(name: string): string {
  const words = name.trim().split(/\s+/);
  let start = words.length - 1;
  while (start > 1 && PARTICLES.has(words[start - 1].toLowerCase())) start--;
  return words.slice(start).join(" ");
}
