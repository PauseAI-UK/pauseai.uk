import "server-only";
import { config } from "@/lib/server/config.server";
import type { SpamReason } from "@/lib/content/spam-check";
import { orFallback } from "./fallback.server";
import { outsideJson } from "./outside-failure.server";
import { outsideFetch } from "./outside-fetch.server";
import { note, problem } from "../problems.server";
import { serverProblems } from "@/lib/server/copy";

// Cloudflare Turnstile, checked on the server. Ported from pauseai-website's
// src/lib/server/turnstile-verify.ts. With neither key set, it's skipped,
// leaving only the honeypot. With just one of them, or one of Cloudflare's
// test secrets outside development, it fails closed and refuses every form.

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's dummy secrets (1x…, 2x…, 3x… then zeros), which pass or fail every token. */
const TEST_SECRET = /^[123]x0{10}/;

/** `drop`, pretend it worked; else `reason`, why the form is refused, if it is. */
export type SpamCheck = { drop: true } | { drop: false; reason?: SpamReason };

function isDev(): boolean {
  return config.nodeEnv === "development";
}

async function verifyTurnstile(token: string | undefined): Promise<SpamReason | undefined> {
  const secret = config.turnstileSecretKey;
  if (!secret && !config.turnstileSiteKey) {
    if (!isDev()) note("Turnstile keys are not set, so the spam check was skipped");
    return undefined;
  }
  if (!secret) {
    if (isDev()) return undefined;
    problem(serverProblems.turnstileUnset());
    return "spam-unavailable";
  }
  if (!isDev() && TEST_SECRET.test(secret)) {
    problem(serverProblems.turnstileTestKey());
    return "spam-misconfigured";
  }
  if (!token) return "spam-wait";

  return orFallback(serverProblems.turnstileDown(), "spam-unreachable" as const, async () => {
    const res = await outsideFetch("turnstile", VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const result = await outsideJson("turnstile", res);
    if (result?.success !== true) {
      note("Turnstile rejected a submission:", result?.["error-codes"]);
      return "spam-failed" as const;
    }
    // No check of the host Turnstile names: on Netlify, the request's own
    // URL is main--pauseaiuk.netlify.app, not pauseai.uk. The widget's
    // allowed hostnames, set in Cloudflare, say where tokens can be made.
    return undefined;
  });
}

/**
 * The honeypot, then Turnstile. `drop` means pretend it worked, so a bot
 * doesn't learn it was caught.
 */
export async function checkNotSpam({
  nickname,
  turnstileToken,
}: {
  nickname?: string;
  turnstileToken?: string;
}): Promise<SpamCheck> {
  if (nickname) return { drop: true };
  const reason = await verifyTurnstile(turnstileToken);
  return reason ? { drop: false, reason } : { drop: false };
}
