import "server-only";
import {
  peopleIn,
  peopleQuery,
  THEYWORKFORYOU_PEOPLE,
  theyWorkForYouIds,
  WIKIDATA_IDS,
  WIKIDATA_QUERY,
  type WikidataPerson,
} from "@/lib/politicians/wikidata";
import { outsideFetch } from "./outside-fetch";

// Wikidata's query service, and TheyWorkForYou's people data on GitHub, no
// key needed. lib/politicians/wikidata.ts writes the queries and reads the answers; this
// fetches them, only when a member's salutation needs their gender.

/** Who we are, as Wikidata asks of every client (https://meta.wikimedia.org/wiki/User-Agent_policy). */
const USER_AGENT = "PauseAI UK (https://pauseai.uk)";

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await outsideFetch(url, {
    ...init,
    headers: { Accept: "application/sparql-results+json, application/json", "User-Agent": USER_AGENT, ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

/** The people with these IDs, by Wikidata's property for them. */
async function people(property: string, ids: string[]): Promise<Map<string, WikidataPerson>> {
  if (ids.length === 0) return new Map();
  return peopleIn(
    await getJson(WIKIDATA_QUERY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query: peopleQuery(property, ids) }).toString(),
    }),
  );
}

/** Senedd members' genders and surnames, by the ID the Senedd gives them. */
export async function seneddPeople(ids: number[]): Promise<Map<number, WikidataPerson>> {
  const found = await people(WIKIDATA_IDS.senedd, ids.map(String));
  return new Map(ids.flatMap((id) => (found.has(String(id)) ? [[id, found.get(String(id))!] as const] : [])));
}

/** MSPs' genders and surnames, by the ID the Scottish Parliament gives them, through TheyWorkForYou's. */
export async function mspPeople(ids: number[]): Promise<Map<number, WikidataPerson>> {
  if (ids.length === 0) return new Map();
  const theirs = theyWorkForYouIds(await getJson(THEYWORKFORYOU_PEOPLE));
  const found = await people(
    WIKIDATA_IDS.theyWorkForYou,
    ids.flatMap((id) => (theirs.has(id) ? [theirs.get(id)!] : [])),
  );
  return new Map(
    ids.flatMap((id) => {
      const person = found.get(theirs.get(id) ?? "");
      return person ? [[id, person] as const] : [];
    }),
  );
}
