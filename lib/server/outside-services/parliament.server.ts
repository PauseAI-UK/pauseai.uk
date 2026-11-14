import "server-only";
import { memberUrl, parliamentEnding, parliamentMembers, parliamentMembersUrl } from "@/lib/politicians/parliament";
import type { Ending, OfficialMember } from "@/lib/politicians/import-changes";
import { outsideFetch } from "./outside-fetch.server";

// Parliament's Members Data Platform and Members API, no key needed.
// lib/politicians/parliament.ts knows their paths and reads their answers; this fetches
// them.

// The Members API answers 429 when asked too much at once. Wait as it says
// (Retry-After, in seconds), or longer each time, and try again.
const ATTEMPTS = 5;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const res = await outsideFetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    // The Members Data Platform starts its JSON with a byte-order mark.
    if (res.ok) return JSON.parse((await res.text()).replace(/^﻿/, ""));
    if ((res.status !== 429 && res.status !== 503) || attempt === ATTEMPTS)
      throw new Error(`${url} returned ${res.status}`);
    const retryAfter = Number(res.headers.get("retry-after"));
    await wait(
      Number.isFinite(retryAfter) && res.headers.has("retry-after") ? retryAfter * 1000 : 1000 * 2 ** (attempt - 1),
    );
  }
}

/** Every sitting member of both Houses, with their emails and websites, as Parliament lists them. */
export async function parliamentMembersNow(): Promise<OfficialMember[]> {
  const [commons, lords] = await Promise.all([
    getJson(parliamentMembersUrl("Commons")),
    getJson(parliamentMembersUrl("Lords")),
  ]);
  return [...parliamentMembers(commons), ...parliamentMembers(lords)];
}

/** Why each of these members' membership ended, by their ID, a few at a time. */
export async function parliamentEndings(ids: number[]): Promise<Map<number, Ending>> {
  const endings = new Map<number, Ending>();
  for (let i = 0; i < ids.length; i += 5) {
    const batch = ids.slice(i, i + 5);
    const answers = await Promise.all(batch.map((id) => getJson(memberUrl(id))));
    batch.forEach((id, j) => endings.set(id, parliamentEnding(answers[j])));
  }
  return endings;
}
