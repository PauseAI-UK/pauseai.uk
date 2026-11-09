import { config } from "@/lib/server/config";

/**
 * Whether this build loads Google Analytics and Tag Manager
 * (components/layout/CookieConsent.tsx). Only the live site does, so a dev
 * server, a deploy preview or a test never counts as a visit. A fixture build
 * sets ANALYTICS=1 (lib/server/fixtures/fixture-env.mjs) so the storyboard can drive the
 * cookie consent flow; it blocks every request to Google itself
 * (tests/storyboard/fixtures.ts).
 */
export function analyticsEnabled(): boolean {
  return config.production || config.analytics;
}
