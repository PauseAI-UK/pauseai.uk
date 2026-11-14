import "server-only";
import { NI_CONTACTS_URL, NI_MEMBERS_URL, niAssemblyMembers } from "@/lib/politicians/ni-assembly";
import type { OfficialMember } from "@/lib/politicians/import-changes";
import {
  SCOTTISH_PARLIAMENT_API,
  SCOTTISH_PARLIAMENT_LISTS,
  scottishParliamentMembers,
  type ScottishParliamentLists,
} from "@/lib/politicians/scottish-parliament";
import { SENEDD_MEMBERS_URL, seneddMembers } from "@/lib/politicians/senedd";
import { outsideFetch } from "./outside-fetch.server";

// The Scottish Parliament's, the Senedd's and the Northern Ireland Assembly's
// open data, no key needed. lib/politicians/scottish-parliament.ts, lib/politicians/senedd.ts and
// lib/politicians/ni-assembly.ts know their paths and read their answers; this fetches
// them.

/**
 * Who we are, to the bodies' servers. The Senedd's refuses some clients'
 * own User-Agents, curl's among them, with a 403.
 */
const USER_AGENT = "PauseAI UK (https://pauseai.uk)";

async function fetchOk(url: string, accept: string): Promise<Response> {
  const res = await outsideFetch(url, { headers: { Accept: accept, "User-Agent": USER_AGENT }, cache: "no-store" });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res;
}

const getJson = async (url: string) => (await fetchOk(url, "application/json")).json();

/** The Scottish Parliament's sitting members, its lists read at once. */
export async function scottishParliamentMembersNow(now: Date): Promise<OfficialMember[]> {
  const lists = await Promise.all(
    SCOTTISH_PARLIAMENT_LISTS.map((list) => getJson(`${SCOTTISH_PARLIAMENT_API}/${list}`)),
  );
  return scottishParliamentMembers(
    Object.fromEntries(SCOTTISH_PARLIAMENT_LISTS.map((list, i) => [list, lists[i]])) as ScottishParliamentLists,
    now,
  );
}

/** The Senedd's sitting members. */
export async function seneddMembersNow(): Promise<OfficialMember[]> {
  return seneddMembers(await (await fetchOk(SENEDD_MEMBERS_URL, "text/xml")).text());
}

/** The Northern Ireland Assembly's sitting members. */
export async function niAssemblyMembersNow(): Promise<OfficialMember[]> {
  const [members, contacts] = await Promise.all([getJson(NI_MEMBERS_URL), getJson(NI_CONTACTS_URL)]);
  return niAssemblyMembers(members, contacts);
}
