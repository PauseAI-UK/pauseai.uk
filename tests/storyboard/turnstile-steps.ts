import type { Page } from "@playwright/test";

// Cloudflare's real widget mustn't load in a test. This stands in for its
// script: it draws nothing and hands over a token at once, which the
// Turnstile fixture on the server then accepts.
const FAKE_TURNSTILE = `
  window.turnstile = {
    render: (el, options) => { setTimeout(() => options.callback("fixture-token")); return "fake"; },
    remove: () => {},
  };
  window.onTurnstileLoad();
`;

/** Serves the stand-in Turnstile script to this page, on every host. */
export async function fakeTurnstile(page: Page) {
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: FAKE_TURNSTILE }),
  );
}
