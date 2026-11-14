// Members' genders, and surnames where it has them, from Wikidata
// (https://query.wikidata.org/, no key needed), for the salutations of
// MSPs and Senedd members, whose bodies give neither a title nor a gender
// (lib/politicians/salutation.ts). A member is found by an ID, never by name: a Senedd
// member by their Senedd ID (P4651), the ID the Senedd gives them; an MSP by
// their TheyWorkForYou ID (P2171), which TheyWorkForYou's people data links
// to the ID the Scottish Parliament gives them. Gender is read to choose Mr
// or Ms, and never kept. The caller fetches:
// lib/server/outside-services/wikidata.ts.

import type { Gender } from "./salutation";

export const WIKIDATA_QUERY = "https://query.wikidata.org/sparql";

/** TheyWorkForYou's people, each with the IDs other sources give them (mySociety's parlparse). */
export const THEYWORKFORYOU_PEOPLE = "https://raw.githubusercontent.com/mysociety/parlparse/master/members/people.json";

/** Wikidata's properties for the IDs a member is found by. */
export const WIKIDATA_IDS = { senedd: "P4651", theyWorkForYou: "P2171" } as const;

/** A member's gender and surname, as Wikidata has them. */
export type WikidataPerson = { gender: Gender; surname?: string };

/** Wikidata's items for men and women, trans men and trans women among them. */
const GENDERS: Record<string, Gender> = {
  Q6581097: "male",
  Q2449503: "male",
  Q6581072: "female",
  Q1052281: "female",
};

/** The SPARQL that finds the people with these IDs, by Wikidata's property for them. */
export function peopleQuery(property: string, ids: string[]): string {
  const values = ids.map((id) => JSON.stringify(id)).join(" ");
  return `SELECT ?id ?gender ?surname WHERE {
  VALUES ?id { ${values} }
  ?person wdt:${property} ?id .
  OPTIONAL { ?person wdt:P21 ?gender }
  OPTIONAL { ?person wdt:P734 ?family . ?family rdfs:label ?surname . FILTER(lang(?surname) = "en") }
}`;
}

type Binding = { id: { value: string }; gender?: { value: string }; surname?: { value: string } };

/** Each person in a query's answer (peopleQuery), by the ID they were found by. */
export function peopleIn(data: unknown): Map<string, WikidataPerson> {
  const bindings = (data as { results?: { bindings?: Binding[] } } | null)?.results?.bindings;
  if (!Array.isArray(bindings)) throw new Error("Wikidata's answer has no results");
  const people = new Map<string, WikidataPerson>();
  for (const b of bindings) {
    const known = people.get(b.id.value);
    const item = b.gender?.value.split("/").pop();
    people.set(b.id.value, {
      gender: known?.gender ?? (item === undefined ? undefined : (GENDERS[item] ?? "other")),
      surname: known?.surname ?? b.surname?.value,
    });
  }
  return people;
}

type TheyWorkForYouPerson = { id: string; identifiers?: { scheme: string; identifier: string }[] };

/** Each MSP's TheyWorkForYou ID (the number at the end of theirs), by the ID the Scottish Parliament gives them. */
export function theyWorkForYouIds(data: unknown): Map<number, string> {
  const persons = (data as { persons?: TheyWorkForYouPerson[] } | null)?.persons;
  if (!Array.isArray(persons)) throw new Error("TheyWorkForYou's people data has no people");
  return new Map(
    persons.flatMap((p) => {
      const scottish = p.identifiers?.find((i) => i.scheme === "scotparl_id")?.identifier;
      return scottish ? [[Number(scottish), p.id.split("/").pop()!] as const] : [];
    }),
  );
}
