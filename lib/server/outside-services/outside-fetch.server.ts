import "server-only";
import { config } from "@/lib/server/config.server";
import type { Fake } from "@/lib/server/fixtures/fake";
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

/** A service, and its fake, which answers in its place in a fixture build (lib/server/fixtures/fakes/). */
export type Outside = { service: OutsideService; fake: Fake };

export type OutsideInit = RequestInit & {
  /**
   * How many more times to ask after an answer of 429 or 503, waiting as its
   * Retry-After says, or else a second, then two, then four. Only for a
   * request that's safe to repeat: one that reads, or that the service
   * takes once however often it's sent.
   */
  retries?: number;
  /**
   * The longest it waits to ask again, in seconds: told to wait longer, it
   * gives the answer it has, for the caller to carry on without the service,
   * as a page someone is waiting on can't wait long.
   */
  mostWait?: number;
  /**
   * For a URL someone typed: one whose host is or resolves to an internal
   * address, such as a loopback, private or link-local one, throws an
   * OutsideFailure of kind `unreachable`, and nothing is sent
   * (public-address.server.ts). It checks this URL only, so a caller that
   * sets it also asks for `redirect: "manual"` and checks each redirect's.
   */
  publicOnly?: boolean;
};

/**
 * fetch() for calls to outside services (Luma, Airtable, postcodes.io, ...). With
 * DATA_FIXTURES=1 the service's fake answers instead, unless it's one of
 * config.realServices, or the storyboard flow has made the service fail (lib/server/fixtures/failing-services.ts), so a test build
 * renders the same data every time and works offline (docs/testing.md).
 * The calling code still parses the response, so it is exercised either way.
 * A service that can't be reached, or doesn't answer in time, throws an
 * OutsideFailure for the service, of kind `unreachable` or `timeout`. An
 * answer that isn't ok is returned, for the binding to say what kind of
 * refusal it is.
 */
export async function outsideFetch({ service, fake }: Outside, url: string, init: OutsideInit = {}): Promise<Response> {
  const { retries = 0, mostWait = Infinity, publicOnly = false, ...request } = init;
  if (config.fixtures && !config.realServices.includes(service)) {
    // The storyboard flow's database, for the fakes that keep what they're sent, one set each flow, and the
    // services it has made fail. Imported here, as they read Node's files, so a component that renders on
    // fixture data in the browser doesn't load them.
    const { flowDatabase } = await import("../flow-database.server");
    const { failingResponse } = await import("@/lib/server/fixtures/failing-services");
    const scope = await flowDatabase();
    const parsed = new URL(url);
    return (
      failingResponse(parsed.hostname, scope) ??
      fake(parsed, request, scope) ??
      new Response("No fixture for this URL", { status: 404 })
    );
  }
  // Imported here, as it reads Node's DNS, so a component that renders on fixture data in the browser doesn't load it.
  const { isPublicHost } = await import("./public-address.server");
  if (publicOnly && !(await isPublicHost(new URL(url).hostname))) {
    throw new OutsideFailure(service, "unreachable", { asked: url, message: `${url} isn't on the public internet` });
  }
  for (let attempt = 0; ; attempt++) {
    const res = await answer(service, url, request);
    if (!ASKED_AGAIN.includes(res.status) || attempt === retries) return res;
    const seconds = retryAfterOf(res) ?? 2 ** attempt;
    if (seconds > mostWait) return res;
    await wait(seconds * 1000);
  }
}

/** The statuses whose answer has no body, which a Response can't be made with one. */
const NO_BODY = [204, 205, 304];

/**
 * The service's answer, whatever its status, or an OutsideFailure for none.
 * Its body is read whole here, within the same time limit, so a connection
 * that drops or stalls partway fails as the service's, as one that never
 * answers does, and a binding can read the body without a failure of its own.
 */
async function answer(service: OutsideService, url: string, init: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(OUTSIDE_TIMEOUT_MS) });
    const body = NO_BODY.includes(res.status) ? null : await res.arrayBuffer();
    return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new OutsideFailure(service, timedOut ? "timeout" : "unreachable", { cause: error });
  }
}
