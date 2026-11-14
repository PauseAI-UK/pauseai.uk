// The settings for a build on fixture data (DATA_FIXTURES=1): every outside
// service faked, and the keys set so pages that check for them don't show
// their "not configured" fallback. Shared by playwright.config.ts (this
// branch's build), scripts/serve-main.mjs (main's build), scripts/storyboard.mjs
// and the storyboard's tests, so every side is built and driven the same way.
//
// Plain JavaScript, not TypeScript, so the scripts can import it with Node.

/** The test MPs' inbox in a fixture build. */
export const TEST_MP_EMAIL = "test-mp@parliament.example";

/**
 * The letters inbox in a fixture build, and the tests (LETTERS_INBOX,
 * lib/server/letters-inbox.server.ts): made up, as the real one's address isn't
 * in the repo, but at pauseai.uk, as it has a staff account.
 */
export const LETTERS_INBOX = "fixture-letters@pauseai.uk";

/** Where a fixture build emails when something needs a person (NOTIFICATION_INBOX, lib/server/notifications.server.ts). */
export const NOTIFICATION_INBOX = "fixture-notifications@pauseai.uk";

/**
 * The moment a fixture build thinks it is: the server (lib/now.ts and the
 * database's now(), tests/storyboard/global-setup.ts) and every page's clock
 * (tests/storyboard/fixtures.ts). After both flyering trackers' races, before
 * the march, and before the Luma fixture's upcoming events.
 */
export const FIXTURE_NOW = "2026-10-16T12:00:00.000Z";

/**
 * The storyboard gives each flow its own database, a copy of the template,
 * and names it in this cookie. A fixture build's lib/server/db.server.ts queries the
 * database the cookie names, if it has this prefix.
 */
export const FLOW_DATABASE_COOKIE = "storyboard_database";
export const FLOW_DATABASE_PREFIX = "pauseai_sb_";

/** The response header a storyboard build names the checkout it was built from in (FIXTURE_CHECKOUT, next.config.ts). */
export const CHECKOUT_HEADER = "X-Fixture-Checkout";

/** @param {{ outboxDir: string, origin?: string }} options */
export function fixtureEnv({ outboxDir, origin = "" }) {
  return {
    DATA_FIXTURES: "1",
    // The address the build is served at, which its links and redirects use, as the live site's do its own
    // (SITE_ORIGIN, next.config.ts).
    FIXTURE_ORIGIN: origin,
    FIXTURE_NOW,
    // Analytics loads only on the live site (lib/analytics.server.ts). The
    // storyboard turns it on to drive the cookie consent flow, and blocks
    // every request to Google (tests/storyboard/fixtures.ts).
    ANALYTICS: "1",
    // The fake WhatsApp (lib/server/fixtures/whatsapp.ts). tests/whatsapp-webhooks.ts signs the storyboard's
    // webhooks with the secret.
    WHATSAPP_TOKEN: "fixture",
    WHATSAPP_ACCOUNT_ID: "fixture-account",
    WHATSAPP_APP_SECRET: "fixture-whatsapp-secret",
    LUMA_API_KEY: "fixture",
    // tests/luma-webhooks.ts signs the storyboard's webhooks with it.
    LUMA_WEBHOOK_SECRET: "fixture-luma-webhook-secret",
    CIVICRM_CHAPTER_KEY: "fixture",
    STRIPE_WALL_OF_THANKS_KEY: "fixture",
    // Not one of Cloudflare's test secrets, which are refused outside
    // development. The Turnstile fixture passes every token.
    TURNSTILE_SECRET_KEY: "fixture",
    // Draws the widget, from a stand-in script the tests serve.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "fixture",
    TEST_MP_EMAIL,
    CRON_SECRET: "fixture-cron-secret",
    // Encrypts the fixture Gmail's tokens when a flow connects it.
    GMAIL_TOKEN_KEY: Buffer.alloc(32, 1).toString("base64"),
    POSTMARK_SERVER_TOKEN: "fixture",
    POSTMARK_WEBHOOK_USER: "postmark",
    POSTMARK_WEBHOOK_PASSWORD: "fixture-webhook-password",
    POLICY_INBOX: "policy@example.org",
    NOTIFICATION_INBOX,
    // Each email sent is also written here (lib/server/fixtures/outbox.ts).
    OUTBOX_DIR: outboxDir,
    LETTERS_INBOX,
    // Mail to the letters inbox that a flow writes, for the fake Gmail to pick up (lib/server/fixtures/letters-inbox.ts).
    LETTERS_INBOX_DIR: `${outboxDir}/letters-inbox`,
    // The outside services a flow has made fail for itself (lib/server/fixtures/failing-services.ts).
    FAILING_DIR: `${outboxDir}/failing`,
  };
}
