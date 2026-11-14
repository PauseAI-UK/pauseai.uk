// What an import of a body's members would change: Parliament's (the Commons
// and the Lords), the Scottish Parliament's, the Senedd's and the Northern
// Ireland Assembly's, each read from the body's own list
// (lib/politicians/imports.server.ts). Pure, so a held run can be worked out
// again when it's applied.

import { isOfficialName } from "./constituencies";
import { changedFields, type FieldChange } from "@/lib/field-changes";
import { plainName } from "./domains";
import { isSharedInbox } from "@/lib/one-off";
import type { Country, House, PersonStatus } from "./filters";

/** The bodies whose lists the imports read. Parliament's has two houses, with one ID for a member of either. */
export const BODIES = ["parliament", "scottish-parliament", "senedd", "ni-assembly"] as const;
export type Body = (typeof BODIES)[number];

/** Each body's houses. */
export const BODY_HOUSES: Record<Body, House[]> = {
  parliament: ["commons", "lords"],
  "scottish-parliament": ["scottish-parliament"],
  senedd: ["senedd"],
  "ni-assembly": ["ni-assembly"],
};

/** A member as their body lists them. */
export type OfficialMember = {
  /** The ID their body gives them. */
  officialId: number;
  house: House;
  name: string;
  constituency: string | null;
  party: string;
  country: Country | null;
  /** Each email their body lists for them, lowercased, the one to write to first. */
  emails: string[];
  /** Each web address their body lists for them. */
  websites: string[];
  /** Their salutation by rule (lib/politicians/salutation.ts), or null if the rule can't tell. */
  salutation: string | null;
  /** Their body records their title, so `salutation` is how they asked to be addressed, and wins over ours. */
  titled?: true;
  /** Their surname, where their body gives it apart, to make their salutation when it can't. */
  surname?: string;
};

/** One of our politicians in a body, as an import compares them. */
export type OurPolitician = {
  id: number;
  officialId: number | null;
  house: House;
  name: string;
  salutation: string;
  salutationToCheck: boolean;
  /** Staff have set their salutation by hand, so it's kept whatever their body records. */
  salutationByStaff: boolean;
  constituency: string | null;
  party: string;
  country: Country | null;
  email: string | null;
  status: PersonStatus;
  /** The addresses their body has listed for them (politician_addresses, from 'parliament'). */
  listed: string[];
};

/** Why someone's membership ended, as their body gives it. */
export type Ending = { status: Exclude<PersonStatus, "in_office">; date: string | null; reason: string | null };

/** The fields an import writes, compared one by one. */
export type ImportedFields = Pick<
  OurPolitician,
  | "officialId"
  | "house"
  | "name"
  | "constituency"
  | "party"
  | "country"
  | "email"
  | "status"
  | "salutation"
  | "salutationToCheck"
>;

/** An existing politician the import changes: who, and each field before and after. */
export type ImportChange = { id: number; name: string; changed: Record<string, FieldChange> };

/** A politician the import takes to have left: who, and why, as their body says. */
export type Leaver = { id: number; name: string; house: House; constituency: string | null } & Ending;

/** A politician whose salutation by rule isn't the one we hold, found when they're first linked. */
export type SalutationDifference = { id: number; name: string; ours: string; rule: string };

/** What an import would do. */
export type ImportChanges = {
  /** Members new to our list, as they'll be added. */
  added: OfficialMember[];
  /** Existing politicians whose fields change, linked to their member or not. */
  changed: ImportChange[];
  /** Politicians in office no longer in the list. */
  left: Leaver[];
  /** Whose names change: maybe the same person, maybe not. */
  renamed: { id: number; from: string; to: string }[];
  /** MPs whose constituency isn't spelt as the official list has it, so no postcode would find them. */
  unofficial: { name: string; constituency: string }[];
  /** Salutations by rule unlike ours, for politicians linked to their member for the first time, so each is shown once. */
  salutations: SalutationDifference[];
};

/** A name to match by: no titles, accents, spacing or case. */
const matchName = (name: string) => plainName(name).normalize("NFD").replace(/\p{M}/gu, "");

/**
 * The address to write to after an import: ours, unless the body listed it
 * and has stopped; then, or if we have none, the first the body lists. A
 * shared inbox is never anyone's.
 */
export function nextEmail(ours: Pick<OurPolitician, "email" | "listed">, listed: string[]): string | null {
  const own = listed.filter((address) => !isSharedInbox(address));
  const current = ours.email?.toLowerCase() ?? null;
  if (current && (own.includes(current) || !ours.listed.includes(current) || own.length === 0)) return ours.email;
  return own[0] ?? null;
}

/**
 * Pairs our politicians with the list's members: by ID, then, for one
 * without an ID yet, by name in the same body; an MP also by their seat.
 * A name two of either side share pairs no one.
 */
export function matchMembers(ours: OurPolitician[], members: OfficialMember[]): Map<OfficialMember, OurPolitician> {
  const pairs = new Map<OfficialMember, OurPolitician>();
  const taken = new Set<number>();
  const byId = new Map(ours.filter((p) => p.officialId !== null).map((p) => [p.officialId, p]));
  for (const member of members) {
    const ourOne = byId.get(member.officialId);
    if (ourOne) {
      pairs.set(member, ourOne);
      taken.add(ourOne.id);
    }
  }
  const unlinked = ours.filter((p) => p.officialId === null && !taken.has(p.id));
  const rest = members.filter((m) => !pairs.has(m));
  const unique = <T>(items: T[], key: (item: T) => string | null) => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const k = key(item);
      if (k !== null) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return new Map(
      items.flatMap((item) => {
        const k = key(item);
        return k !== null && counts.get(k) === 1 ? [[k, item] as const] : [];
      }),
    );
  };
  const byName = unique(unlinked, (p) => `${p.house} ${matchName(p.name)}`);
  const theirNames = unique(rest, (m) => `${m.house} ${matchName(m.name)}`);
  for (const [key, member] of theirNames) {
    const ourOne = byName.get(key);
    if (ourOne && !taken.has(ourOne.id)) {
      pairs.set(member, ourOne);
      taken.add(ourOne.id);
    }
  }
  const seat = (p: { house: House; constituency: string | null }) =>
    p.house === "commons" && p.constituency ? p.constituency : null;
  const bySeat = unique(
    unlinked.filter((p) => p.status === "in_office" && !taken.has(p.id)),
    seat,
  );
  for (const member of rest.filter((m) => !pairs.has(m))) {
    const ourOne = bySeat.get(seat(member) ?? "");
    if (ourOne && !taken.has(ourOne.id)) {
      pairs.set(member, ourOne);
      taken.add(ourOne.id);
    }
  }
  return pairs;
}

/** Whether their body records a title for them that makes a salutation unlike ours. */
const titleUnlike = (ours: OurPolitician, member: OfficialMember) =>
  member.titled === true && member.salutation !== ours.salutation;

/** Whether an import takes the salutation their body's title makes: unless staff have set ours by hand. */
const takesTitle = (ours: OurPolitician, member: OfficialMember) =>
  titleUnlike(ours, member) && !ours.salutationByStaff;

/** What an existing politician becomes, given their member. */
export function updated(ours: OurPolitician, member: OfficialMember): ImportedFields {
  // The salutation is made again from what their body lists where it records their title, or where ours was
  // made from the name alone and the rule can now tell; either way, unless staff have set one since.
  const remake =
    (ours.salutationToCheck && ours.salutation === ours.name && member.salutation !== null) || takesTitle(ours, member);
  return {
    officialId: member.officialId,
    house: member.house,
    name: member.name,
    constituency: member.constituency,
    party: member.party,
    country: member.country,
    email: nextEmail(ours, member.emails),
    status: "in_office",
    salutation: remake ? member.salutation! : ours.salutation,
    salutationToCheck: remake ? false : ours.salutationToCheck,
  };
}

/** What a new member is added as. */
export function added(member: OfficialMember): ImportedFields {
  return {
    officialId: member.officialId,
    house: member.house,
    name: member.name,
    constituency: member.constituency,
    party: member.party,
    country: member.country,
    email: nextEmail({ email: null, listed: [] }, member.emails),
    status: "in_office",
    salutation: member.salutation ?? member.name,
    salutationToCheck: member.salutation === null,
  };
}

/** The fields of ours an import compares. */
function current(ours: OurPolitician): ImportedFields {
  return {
    officialId: ours.officialId,
    house: ours.house,
    name: ours.name,
    constituency: ours.constituency,
    party: ours.party,
    country: ours.country,
    email: ours.email,
    status: ours.status,
    salutation: ours.salutation,
    salutationToCheck: ours.salutationToCheck,
  };
}

/**
 * What importing `members`, a body's whole list, would change among `ours`,
 * the body's politicians: who's new, who's changed, and who's left (with
 * why, from `endings`, by their ID, or else just left), and what a person
 * should see first, a name changed or a seat no postcode would find.
 */
export function compareMembers(
  ours: OurPolitician[],
  members: OfficialMember[],
  endings: ReadonlyMap<number, Ending> = new Map(),
): ImportChanges & { pairs: Map<OfficialMember, OurPolitician> } {
  const pairs = matchMembers(ours, members);
  const matched = new Set([...pairs.values()].map((p) => p.id));
  const changes: ImportChanges = { added: [], changed: [], left: [], renamed: [], unofficial: [], salutations: [] };
  for (const member of members) {
    if (member.house === "commons" && member.constituency && !isOfficialName(member.constituency)) {
      changes.unofficial.push({ name: member.name, constituency: member.constituency });
    }
    const ourOne = pairs.get(member);
    if (!ourOne) {
      changes.added.push(member);
      continue;
    }
    const changed = changedFields(current(ourOne), updated(ourOne, member));
    if (Object.keys(changed).length > 0) changes.changed.push({ id: ourOne.id, name: member.name, changed });
    if (matchName(ourOne.name) !== matchName(member.name)) {
      changes.renamed.push({ id: ourOne.id, from: ourOne.name, to: member.name });
    }
    if (
      ourOne.officialId === null &&
      member.salutation !== null &&
      member.salutation !== ourOne.salutation &&
      !takesTitle(ourOne, member)
    ) {
      changes.salutations.push({ id: ourOne.id, name: member.name, ours: ourOne.salutation, rule: member.salutation });
    }
  }
  for (const ourOne of ours) {
    if (ourOne.status !== "in_office" || matched.has(ourOne.id)) continue;
    const ending = (ourOne.officialId !== null && endings.get(ourOne.officialId)) || {
      status: "left_office" as const,
      date: null,
      reason: null,
    };
    changes.left.push({
      id: ourOne.id,
      name: ourOne.name,
      house: ourOne.house,
      constituency: ourOne.constituency,
      ...ending,
    });
  }
  return { ...changes, pairs };
}

/** A salutation staff set by hand that an import keeps, though their body records a title that makes another. */
export type KeptSalutation = { name: string; ours: string; theirs: string };

/** The salutations staff set by hand unlike the titles their bodies record, among matched pairs, for staff to check. */
export function keptSalutations(pairs: ReadonlyMap<OfficialMember, OurPolitician>): KeptSalutation[] {
  return [...pairs].flatMap(([member, ourOne]) =>
    ourOne.salutationByStaff && titleUnlike(ourOne, member)
      ? [{ name: member.name, ours: ourOne.salutation, theirs: member.salutation! }]
      : [],
  );
}

/**
 * More changes than this in one run is held for a person to check. A
 * by-election changes one or two politicians; an election, a body changing
 * its list's shape, or a broken response, changes hundreds.
 */
export const MAX_UNCHECKED_IMPORT_CHANGES = 20;

/** How many politicians an import changes. */
export function importChangeCount(changes: Pick<ImportChanges, "added" | "changed" | "left">): number {
  return changes.added.length + changes.changed.length + changes.left.length;
}

/** Whether an import is held for a person: too many changes, a name changed, or a seat no postcode would find. */
export function holdsImport(changes: ImportChanges): boolean {
  return (
    importChangeCount(changes) > MAX_UNCHECKED_IMPORT_CHANGES ||
    changes.renamed.length > 0 ||
    changes.unofficial.length > 0
  );
}

/** The addresses listed for two or more members: an office's or a shared inbox, which says nothing of whose a thread is. */
export function sharedAddresses(members: Pick<OfficialMember, "emails">[]): Set<string> {
  const seen = new Map<string, number>();
  for (const { emails } of members) {
    for (const email of new Set(emails)) seen.set(email, (seen.get(email) ?? 0) + 1);
  }
  return new Set([...seen].filter(([, n]) => n > 1).map(([email]) => email));
}
