import "server-only";
import { config } from "@/lib/server/config.server";
import { readJsonIfAny } from "@/lib/server/json.server";
import { outsideFetch } from "./outside-fetch.server";

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

/** Luma answered 429: wait `retryAfter` seconds. */
export class LumaRateLimited extends Error {
  constructor(public readonly retryAfter: number) {
    super(`Luma's rate limit reached: retry after ${retryAfter}s`);
  }
}

/** Luma answered with an error other than a 429: its status, and the message its answer gave, if it gave one. */
export class LumaRefused extends Error {
  constructor(
    public readonly status: number,
    path: string,
    public readonly lumaMessage?: string,
  ) {
    super(`Luma answered ${status} for ${path}${lumaMessage ? `: ${lumaMessage}` : ""}`);
  }
}

/** The error for Luma's answer to `path` that isn't ok: LumaRateLimited for a 429, otherwise LumaRefused. */
async function refusal(res: Response, path: string): Promise<Error> {
  if (res.status === 429) return new LumaRateLimited(Number(res.headers.get("retry-after")) || 60);
  const body = (await readJsonIfAny(res)) as { message?: unknown } | null | undefined;
  return new LumaRefused(res.status, path, typeof body?.message === "string" ? body.message : undefined);
}

/** LUMA_API_KEY, or throws without it. */
function lumaKey(): string {
  if (!config.lumaApiKey) throw new Error("LUMA_API_KEY is not set");
  return config.lumaApiKey;
}

/**
 * Fetches `path` with `params`: its JSON, and the requests left in this
 * minute when Luma says. Uncached, unless `revalidate` says how many seconds
 * Next may keep the answer. Throws LumaRateLimited on a 429, LumaRefused
 * on any other answer that isn't ok, and an Error for a missing key.
 */
export async function lumaGet<T>(
  path: string,
  params: URLSearchParams,
  revalidate?: number,
): Promise<{ data: T; remaining?: number }> {
  const res = await outsideFetch(`https://public-api.luma.com${path}?${params}`, {
    headers: { "x-luma-api-key": lumaKey(), accept: "application/json" },
    ...(revalidate === undefined ? { cache: "no-store" } : { next: { revalidate } }),
  });
  if (!res.ok) throw await refusal(res, path);
  const remaining = res.headers.get("x-ratelimit-remaining");
  return { data: (await res.json()) as T, remaining: remaining === null ? undefined : Number(remaining) };
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
  const res = await outsideFetch(`https://public-api.luma.com${path}`, {
    method: "POST",
    headers: { "x-luma-api-key": lumaKey(), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw await refusal(res, path);
  return (await res.json()) as T;
}
