import "server-only";
import { config } from "@/lib/server/config.server";
import { fixtureResponse } from "@/lib/server/fixtures/outside-services";

/**
 * How long a service has to answer, unless the call sets its own limit: well
 * within the 30 seconds Netlify gives a function, so that a run whose service
 * hangs gets to record its failure rather than being stopped mid-call.
 */
export const OUTSIDE_TIMEOUT_MS = 20_000;

/**
 * fetch() for calls to outside services (Luma, Airtable, postcodes.io, ...). With
 * DATA_FIXTURES=1 it answers from lib/server/fixtures/ instead, so a test build
 * renders the same data every time and works offline (docs/testing.md).
 * The calling code still parses the response, so it is exercised either way.
 * A service that doesn't answer in time is given up on, with a TimeoutError.
 */
export async function outsideFetch(url: string, init?: RequestInit): Promise<Response> {
  if (config.fixtures) {
    // The storyboard flow's database, for the fakes that keep what they're sent, one set each flow.
    // Imported here, so a component that renders on fixture data in the browser doesn't load it.
    const { flowDatabase } = await import("../flow-database.server");
    return fixtureResponse(url, init, await flowDatabase()) ?? new Response("No fixture for this URL", { status: 404 });
  }
  return fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(OUTSIDE_TIMEOUT_MS) });
}
