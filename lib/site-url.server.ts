import "server-only";

// Every absolute URL on this site, for a link in an email or a redirect,
// comes from siteUrl(). ESLint keeps the other ways of finding the site's
// address out of the rest of the code (SITE_URL_RULE in eslint.config.mjs).

import { headers } from "next/headers";
import { config } from "@/lib/server/config.server";

/**
 * An absolute URL on this site, built from the deploy's own address, fixed at
 * build time (SITE_ORIGIN in next.config.ts): pauseai.uk in production. Never
 * from the request. On Netlify its URL has the main--pauseaiuk.netlify.app
 * host, where none of the pauseai.uk cookies are, and whoever sends it can
 * set its Host, so a login link built from it could hand them the token.
 * Only a local build, which Netlify didn't make, uses the request's origin,
 * so there, without a request (a Server Action's), it can't say.
 */
export function siteUrl(path: string, request: Request | undefined): URL {
  const url = siteUrlIfKnown(path, request);
  if (!url) throw new Error("This build doesn't know its own address: SITE_ORIGIN isn't set");
  return url;
}

/** The same, or undefined where this build can't say, for a link that can do without. */
export function siteUrlIfKnown(path: string, request: Request | undefined): URL | undefined {
  const origin = config.siteOrigin || (config.localBuild ? request?.url : "");
  return origin ? new URL(path, origin) : undefined;
}

/**
 * For a Server Action, which has no request of its own: one standing for it
 * on a local build, at the address it was called on, from its Host, so a link
 * it emails can be built there as a route's is. Undefined anywhere else, where
 * the deploy's own address is used and the Host is never trusted.
 */
export async function actionRequest(): Promise<Request | undefined> {
  if (!config.localBuild) return undefined;
  const host = (await headers()).get("host");
  return host ? new Request(`http://${host}/`) : undefined;
}
