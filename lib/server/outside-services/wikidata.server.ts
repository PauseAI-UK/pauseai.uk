import "server-only";
import type { Body, Honour } from "@/lib/politicians/import-changes";
import {
  honoursIn,
  honoursQuery,
  peopleIn,
  peopleQuery,
  THEYWORKFORYOU_PEOPLE,
  theyWorkForYouIds,
  WIKIDATA_IDS,
  WIKIDATA_QUERY,
  type WikidataPerson,
} from "@/lib/politicians/wikidata";
import { refusal } from "./outside-failure.server";
import { outsideFetch } from "./outside-fetch.server";

// Wikidata's query service, and TheyWorkForYou's people data on GitHub, no
// key needed. lib/politicians/wikidata.ts writes the queries and reads the answers; this
// fetches them: genders only when a member's salutation needs one, and honours on every import.

/** Who we are, as Wikidata asks of every client (https://meta.wikimedia.org/wiki/User-Agent_policy). */
const USER_AGENT = "PauseAI UK (https://pauseai.uk)";

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await outsideFetch("wikidata", url, {
    ...init,
    headers: { Accept: "application/sparql-results+json, application/json", "User-Agent": USER_AGENT, ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) throw refusal("wikidata", res, { asked: url });
  return res.json();
}

/** The answer to a query Wikidata's query service is sent. */
async function ask(sparql: string): Promise<unknown> {
  return getJson(WIKIDATA_QUERY, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ query: sparql }).toString(),
  });
}

/**
 * What Wikidata says of a body's members, by the ID their body gives them:
 * `read` asks it of their IDs as Wikidata keeps them, by its property for
 * them, and gives each answer by that ID. Only those Wikidata knows.
 */
async function byMember<T>(
  body: Body,
  ids: number[],
  read: (property: string, values: string[]) => Promise<Map<string, T>>,
): Promise<Map<number, T>> {
  if (ids.length === 0) return new Map();
  const theirs =
    body === "scottish-parliament"
      ? theyWorkForYouIds(await getJson(THEYWORKFORYOU_PEOPLE))
      : new Map(ids.map((id) => [id, String(id)]));
  const property = body === "scottish-parliament" ? WIKIDATA_IDS.theyWorkForYou : WIKIDATA_IDS[body];
  const values = ids.flatMap((id) => (theirs.has(id) ? [theirs.get(id)!] : []));
  if (values.length === 0) return new Map();
  const found = await read(property, values);
  return new Map(
    ids.flatMap((id) => {
      const answer = found.get(theirs.get(id) ?? "");
      return answer === undefined ? [] : [[id, answer] as const];
    }),
  );
}

/** Senedd members' genders and surnames, by the ID the Senedd gives them. */
export async function seneddPeople(ids: number[]): Promise<Map<number, WikidataPerson>> {
  return byMember("senedd", ids, async (property, values) => peopleIn(await ask(peopleQuery(property, values))));
}

/** MSPs' genders and surnames, by the ID the Scottish Parliament gives them, through TheyWorkForYou's. */
export async function mspPeople(ids: number[]): Promise<Map<number, WikidataPerson>> {
  return byMember("scottish-parliament", ids, async (property, values) =>
    peopleIn(await ask(peopleQuery(property, values))),
  );
}

/** Which of a body's members Wikidata calls Sir or Dame, by the ID their body gives them. */
export async function memberHonours(body: Body, ids: number[]): Promise<Map<number, Honour>> {
  return byMember(body, ids, async (property, values) => honoursIn(await ask(honoursQuery(property, values))));
}
