import "server-only";
import { EDM_API, edmSigners, type EdmSigner } from "@/lib/asks/edm";
import { memberUrl, parliamentEnding, parliamentMembers, parliamentMembersUrl } from "@/lib/politicians/parliament";
import type { Ending, OfficialMember } from "@/lib/politicians/import-changes";
import { refusal } from "./outside-failure.server";
import { parliamentFake } from "@/lib/server/fixtures/fakes/parliament";
import { outsideFetch, type Outside } from "./outside-fetch.server";

const PARLIAMENT: Outside = { service: "parliament", fake: parliamentFake };

// Parliament's Members Data Platform and Members API, and its API for
// motions, no key needed. lib/politicians/parliament.ts and lib/asks/edm.ts
// know their paths and read their answers; this fetches them.

// The Members API answers 429 when asked too much at once: each request is
// asked again, as outsideFetch does, up to this many times in all.
const ATTEMPTS = 5;

async function getJson(url: string): Promise<unknown> {
  const res = await outsideFetch(PARLIAMENT, url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    retries: ATTEMPTS - 1,
  });
  if (!res.ok) throw refusal("parliament", res, { asked: url });
  // The Members Data Platform starts its JSON with a byte-order mark.
  return JSON.parse((await res.text()).replace(/^﻿/, ""));
}

/** Every sitting member of both Houses, with their emails and websites, as Parliament lists them. */
export async function parliamentMembersNow(): Promise<OfficialMember[]> {
  const [commons, lords] = await Promise.all([
    getJson(parliamentMembersUrl("Commons")),
    getJson(parliamentMembersUrl("Lords")),
  ]);
  return [...parliamentMembers(commons), ...parliamentMembers(lords)];
}

/** Who has signed the superintelligence EDM (lib/asks/edm.ts). */
export async function edmSignersNow(): Promise<EdmSigner[]> {
  return edmSigners(await getJson(EDM_API));
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
