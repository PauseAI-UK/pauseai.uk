import { json, type Fake } from "../fake";

// Cloudflare Turnstile's check, which passes every visitor.

export const turnstileFake: Fake = ({ hostname, pathname }) =>
  hostname === "challenges.cloudflare.com" && pathname === "/turnstile/v0/siteverify"
    ? json({ success: true, hostname: "localhost" })
    : undefined;
