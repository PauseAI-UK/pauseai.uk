import "server-only";
import { config } from "@/lib/server/config.server";
import { readJsonIfAny } from "@/lib/server/json.server";
import { notSet, type OutsideFailure, outsideJson, refusal, retryAfterOf } from "./outside-failure.server";
import { lumaFake } from "@/lib/server/fixtures/fakes/luma";
import { outsideFetch, type Outside } from "./outside-fetch.server";

const LUMA: Outside = { service: "luma", fake: lumaFake };

// One page of a list from Luma's official API (LUMA_API_KEY, scoped to our
// calendar), for the import, which pages through events, guests and
// contacts. Luma allows 200 requests a minute, shared with the site's own
// fetches, answers 429 beyond that, and says in every response how many are
// left. Pages are capped at 50.

/** The most entries a page can hold. */
export const LUMA_PAGE_SIZE = 50;

export type LumaPage<T> = {
  entries: T[];
  /** The cursor for the next page, if there is one. */
  nextCursor?: string;
  /** Requests left in this minute, by Luma's x-ratelimit-remaining header, when it sends one. */
  remaining?: number;
};

/**
 * Luma's own code on a failure for an address that isn't one of the
 * calendar's contacts. Its 404 for one says so only in its message, unlike
 * the plain "Not found." of a 404 for a path it doesn't know.
 */
export const LUMA_NOT_A_CONTACT = "not-a-contact";

/**
 * The failure for Luma's answer to `path` that isn't ok, with the message
 * its answer gave, if it gave one: rate-limited for a 429, to wait as its
 * Retry-After says or a minute.
 */
async function lumaRefusal(res: Response, path: string): Promise<OutsideFailure> {
  if (res.status === 429) {
    const retryAfter = retryAfterOf(res) || 60;
    return refusal("luma", res, { retryAfter, message: `Luma's rate limit reached: retry after ${retryAfter}s` });
  }
  const body = (await readJsonIfAny(res)) as { message?: unknown } | null | undefined;
  const said = typeof body?.message === "string" ? body.message : undefined;
  const notAContact = res.status === 404 && /couldn.t find that contact/i.test(said ?? "");
  return refusal("luma", res, { asked: path, said, ...(notAContact && { serviceCode: LUMA_NOT_A_CONTACT }) });
}

/** LUMA_API_KEY, or throws without it. */
function lumaKey(): string {
  if (!config.lumaApiKey) throw notSet("luma", "LUMA_API_KEY");
  return config.lumaApiKey;
}

/**
 * Fetches `path` with `params`: its JSON, and the requests left in this
 * minute when Luma says. Uncached, unless `revalidate` says how many seconds
 * Next may keep the answer. Throws an OutsideFailure: rate-limited on a
 * 429, by its status on any other answer that isn't ok, refused for one
 * that's ok but isn't JSON, and unauthorised for a missing key.
 */
export async function lumaGet<T>(
  path: string,
  params: URLSearchParams,
  revalidate?: number,
): Promise<{ data: T; remaining?: number }> {
  const res = await outsideFetch(LUMA, `https://public-api.luma.com${path}?${params}`, {
    headers: { "x-luma-api-key": lumaKey(), accept: "application/json" },
    ...(revalidate === undefined ? { cache: "no-store" } : { next: { revalidate } }),
  });
  if (!res.ok) throw await lumaRefusal(res, path);
  const remaining = res.headers.get("x-ratelimit-remaining");
  return { data: (await outsideJson("luma", res)) as T, remaining: remaining === null ? undefined : Number(remaining) };
}

/** Fetches one page of `path` with `params`, as lumaGet does, as raw entries. */
export async function lumaList<T>(path: string, params: URLSearchParams, revalidate?: number): Promise<LumaPage<T>> {
  const { data, remaining } = await lumaGet<{ entries?: T[]; has_more?: boolean; next_cursor?: string }>(
    path,
    params,
    revalidate,
  );
  return {
    entries: data.entries ?? [],
    nextCursor: data.has_more && data.next_cursor ? data.next_cursor : undefined,
    remaining,
  };
}

/**
 * Posts `body` to `path`: Luma's JSON answer. Throws as lumaGet does, for a
 * missing key, a 429 or any other answer that isn't ok.
 */
export async function lumaPost<T>(path: string, body: unknown): Promise<T> {
  const res = await outsideFetch(LUMA, `https://public-api.luma.com${path}`, {
    method: "POST",
    headers: { "x-luma-api-key": lumaKey(), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw await lumaRefusal(res, path);
  return (await outsideJson("luma", res)) as T;
}
