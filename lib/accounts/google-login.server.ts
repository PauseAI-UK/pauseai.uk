import "server-only";
import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/server/config.server";
import { parseJsonIfAny } from "@/lib/server/json.server";
import { createSession } from "./auth.server";
import { LIVE_LOGIN_KEY } from "./live-login-key";
import { afterLogin, GOOGLE_API_PATH, keepCookie, sessionCookie } from "./session";

// Staff log in with their pauseai.uk Google account. Google sends people
// back only to addresses listed in advance on the OAuth client, exactly,
// and each deploy preview has its own address, so only the live site's is
// listed. A preview's login goes through the live site: the preview keeps a
// random nonce in a cookie and sends the person to the live site, which
// goes to Google and, back from it, signs a note saying who logged in, for
// which preview and nonce, good for NOTE_SECONDS. The preview checks the
// note with the live site's public key, and its nonce, so the note works
// only in the browser that started, and starts a session in its own
// database. Only the live site holds the private key, so a preview, which
// runs whatever its branch says, can't log anyone in to the live site.
//
// The three steps are routes under GOOGLE_API_PATH: start, callback and
// handoff.

/** The live site, the only address Google sends people back to. */
export const LIVE_ORIGIN = "https://pauseai.uk";

/** A deploy preview's or branch deploy's address, which the live site will pass a login on to. */
const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+--pauseaiuk\.netlify\.app$/;

/** How long a note the live site signs for a preview lasts. */
const NOTE_SECONDS = 60;

/** What a login keeps between its steps, in a cookie under GOOGLE_API_PATH, for 15 minutes. */
export const GOOGLE_LOGIN_COOKIE = "staff_google_login";

/**
 * A login under way: on the site that goes to Google, the `state` it went
 * with and, for a preview, the preview's address and nonce; on a preview,
 * its nonce. Either way, whether to keep them signed in and the page to go
 * to once logged in.
 */
export type Started = { state?: string; preview?: string; nonce?: string; remember: boolean; next: string };

/** Whether this build goes to Google itself: the live site, or a fixture build, whose Google is fake. Else it's a preview. */
export function goesToGoogle(): boolean {
  return config.production || config.fixtures;
}

/** Whether `origin` is a preview's, which the live site will pass a login on to. */
export function isPreviewOrigin(origin: string): boolean {
  return PREVIEW_ORIGIN.test(origin);
}

/** A random state or nonce. */
export function newSecret(): string {
  return randomBytes(24).toString("base64url");
}

/** The cookie keeping a login under way. */
export function startedCookie(started: Started) {
  return {
    name: GOOGLE_LOGIN_COOKIE,
    value: JSON.stringify(started),
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: GOOGLE_API_PATH,
    maxAge: 15 * 60,
  };
}

/** The login under way, from its cookie, if it holds one. */
export function readStarted(cookie: string | undefined): Started | undefined {
  const value = parseJsonIfAny(cookie ?? "");
  if (!value || typeof value !== "object") return undefined;
  const { state, preview, nonce, remember, next } = value as Record<string, unknown>;
  const text = (field: unknown) => (typeof field === "string" ? field : undefined);
  return {
    state: text(state),
    preview: text(preview),
    nonce: text(nonce),
    remember: remember === true,
    next: afterLogin(next),
  };
}

/**
 * The note the live site passes on to `preview`: that `email` logged in,
 * for the browser holding `nonce`, until NOTE_SECONDS from `now`. Its claims
 * and their Ed25519 signature, each base64url, joined by a dot.
 */
export function signLogin(email: string, preview: string, nonce: string, now = Date.now()): string {
  const key = config.googleLoginSigningKey;
  if (!key) throw new Error("GOOGLE_LOGIN_SIGNING_KEY isn't set");
  const claims = { email, origin: preview, nonce, expires: now + NOTE_SECONDS * 1000 };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const privateKey = createPrivateKey({ key: Buffer.from(key, "base64"), format: "der", type: "pkcs8" });
  return `${body}.${sign(null, Buffer.from(body), privateKey).toString("base64url")}`;
}

/**
 * Who a note says logged in, if the live site signed it, for `origin`, this
 * site, and `nonce`, this browser's, and it hasn't expired.
 */
export function readLogin(note: string, origin: string, nonce: string, now = Date.now()): string | undefined {
  const [body, signature = ""] = note.split(".");
  const publicKey = createPublicKey({ key: Buffer.from(LIVE_LOGIN_KEY, "base64"), format: "der", type: "spki" });
  if (!verify(null, Buffer.from(body), publicKey, Buffer.from(signature, "base64url"))) return undefined;
  // Signed by the live site, so it's what signLogin made.
  const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as {
    email: string;
    origin: string;
    nonce: string;
    expires: number;
  };
  return claims.origin === origin && claims.nonce === nonce && claims.expires > now ? claims.email : undefined;
}

/**
 * Logs `email` in: a session, kept if they ticked the box, and on to the
 * page they were going to, forgetting the login under way.
 */
export async function loggedIn(request: NextRequest, email: string, started: Started, to: URL): Promise<NextResponse> {
  const response = NextResponse.redirect(to, 303);
  const token = await createSession(email, started.remember, request.headers.get("user-agent"));
  response.cookies.set(sessionCookie(token, started.remember));
  if (started.remember) response.cookies.set(keepCookie());
  response.cookies.delete({ name: GOOGLE_LOGIN_COOKIE, path: GOOGLE_API_PATH });
  return response;
}
