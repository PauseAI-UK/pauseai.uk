// What every fake of an outside service shares (./fakes/). A binding hands
// outsideFetch its service's fake, which a fixture build answers from, so a
// change to one fake reaches only the code that calls that service; the
// tests' fetch asks every fake (./outside-services.ts). Matched on host and
// path rather than the full URL, so query strings (dates, pagination,
// filters) don't need listing.

/**
 * The canned response to a request to one service, if there is one.
 * `scope` is the storyboard flow's database, for the fakes that keep what
 * they're sent (the letters inbox, letters-inbox.ts).
 */
export type Fake = (url: URL, init: RequestInit | undefined, scope: string | undefined) => Response | undefined;

export function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}
