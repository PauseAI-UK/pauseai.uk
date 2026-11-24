import "server-only";
import { randomBytes } from "node:crypto";
import { config } from "@/lib/server/config.server";
import { note } from "@/lib/server/problems.server";
import { siteUrl } from "@/lib/site-url.server";
import { isStaffEmail } from "./permissions";
import { LOCAL_LOGIN_PATH } from "./session";

// Logging in on a local build without fixtures. Google sends people back
// only to the live site, and the live site passes a login on only to a
// deploy preview (lib/accounts/google-login.server.ts), so such a build
// can't log in with Google. Instead the login page takes a pauseai.uk
// address and prints a link in the dev server's terminal, which logs in
// once, for LINK_MINUTES. Only someone who can read the terminal can use
// it, so it's safe even where the dev server is reachable from elsewhere
// on the network. The links are kept in memory, as the build is one
// process. Anywhere else, including the live site, previews and fixture
// builds, there's none.

const LINK_MINUTES = 15;

/** A link printed and not yet used: whom it logs in, as they asked, and until when. */
type Link = { email: string; remember: boolean; next: string; expires: number };

/** The links printed, by token, kept across the dev server's reloads of this module. */
const links = ((globalThis as { localLoginLinks?: Map<string, Link> }).localLoginLinks ??= new Map());

/** Whether this build logs in with a printed link: a local build, not a fixture build. */
export function localLogin(): boolean {
  return config.localBuild && !config.fixtures;
}

/**
 * Prints a link that logs `email` in, keeping "Keep me signed in" and the
 * page to go to, if it's a pauseai.uk address; else says why there's none.
 */
export function printLoginLink(
  email: string,
  { remember, next }: { remember: boolean; next: string },
  request: Request,
  now = Date.now(),
): void {
  if (!isStaffEmail(email)) {
    note(`No login link: ${email} isn't a pauseai.uk address`);
    return;
  }
  const token = randomBytes(32).toString("base64url");
  links.set(token, { email, remember, next, expires: now + LINK_MINUTES * 60_000 });
  note(`Log in as ${email}: ${siteUrl(`${LOCAL_LOGIN_PATH}?token=${token}`, request).href}`);
}

/** Whom a printed link logs in, if it's current and unused. It then can't be used again. */
export function redeemLoginLink(token: string, now = Date.now()): Omit<Link, "expires"> | undefined {
  const link = links.get(token);
  links.delete(token);
  if (!link || link.expires <= now) return undefined;
  return { email: link.email, remember: link.remember, next: link.next };
}
