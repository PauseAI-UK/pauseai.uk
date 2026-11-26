import type { Fake } from "../fake";

/** A web page with a card's Open Graph tags, its title's ampersand written as HTML writes one. */
function linkedPage(): Response {
  return new Response(
    `<!doctype html><html><head><title>March</title>
<meta property="og:title" content="March Against AI Extinction &amp; for a pause">
<meta property="og:description" content="Join thousands in London to call for a pause on the race to superintelligence.">
<meta property="og:url" content="https://pauseai.uk/march">
<meta property="og:site_name" content="PauseAI UK">
</head><body></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// A page on our site a text links to, read for the link's card: every
// page the same, with the Open Graph tags WhatsApp makes it from.
export const linkPagesFake: Fake = ({ hostname }) => (hostname === "pauseai.uk" ? linkedPage() : undefined);
