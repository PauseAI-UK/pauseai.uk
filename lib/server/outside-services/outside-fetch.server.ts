import "server-only";
import { config } from "@/lib/server/config.server";
import { fixtureResponse } from "@/lib/server/fixtures/outside-services";
import { OutsideFailure, type OutsideService, retryAfterOf } from "./outside-failure.server";

/**
 * How long a service has to answer, unless the call sets its own limit: well
 * within the 30 seconds Netlify gives a function, so that a run whose service
 * hangs gets to record its failure rather than being stopped mid-call.
 */
export const OUTSIDE_TIMEOUT_MS = 20_000;

/** The answers worth asking again after: asked too much, or not there for now. */
const ASKED_AGAIN = [429, 503];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type OutsideInit = RequestInit & {
  /**
   * How many more times to ask after an answer of 429 or 503, waiting as its
   * Retry-After says, or else a second, then two, then four. Only for a
   * request that's safe to repeat: one that reads, or that the service
   * takes once however often it's sent.
   */
  retries?: number;
};

/**
 * fetch() for calls to outside services (Luma, Airtable, postcodes.io, ...). With
 * DATA_FIXTURES=1 it answers from lib/server/fixtures/ instead, so a test build
 * renders the same data every time and works offline (docs/testing.md).
 * The calling code still parses the response, so it is exercised either way.
 * A service that can't be reached, or doesn't answer in time, throws an
 * OutsideFailure for `service`, of kind `unreachable` or `timeout`. An
 * answer that isn't ok is returned, for the binding to say what kind of
 * refusal it is.
 */
export async function outsideFetch(service: OutsideService, url: string, init: OutsideInit = {}): Promise<Response> {
  const { retries = 0, ...request } = init;
  if (config.fixtures) {
    // The storyboard flow's database, for the fakes that keep what they're sent, one set each flow.
    // Imported here, so a component that renders on fixture data in the browser doesn't load it.
    const { flowDatabase } = await import("../flow-database.server");
    return (
      fixtureResponse(url, request, await flowDatabase()) ?? new Response("No fixture for this URL", { status: 404 })
    );
  }
  for (let attempt = 0; ; attempt++) {
    const res = await answer(service, url, request);
    if (!ASKED_AGAIN.includes(res.status) || attempt === retries) return res;
    await wait((retryAfterOf(res) ?? 2 ** attempt) * 1000);
  }
}

/** The service's answer, whatever its status, or an OutsideFailure for none. */
async function answer(service: OutsideService, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(OUTSIDE_TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new OutsideFailure(service, timedOut ? "timeout" : "unreachable", { cause: error });
  }
}
