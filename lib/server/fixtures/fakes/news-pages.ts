import type { Fake } from "../fake";

// The news articles the press survey reads (import-press), at the
// addresses google-news.ts's links lead to: each a page laid out as news
// sites lay theirs out, saying of PauseAI what its note in FIXTURE_NEWS
// says.

/**
 * The rest of each report, long enough that Readability takes the article
 * from the page, as it would a real one's, and leaves out the menu and
 * footer (lib/press/page.ts).
 */
const REPORT = `<p>Officials said the question would be taken up again at the next meeting, after a consultation that runs until the end of the year. Several groups have asked to give evidence, and the committee expects to publish their submissions alongside its own findings. Those who spoke to this paper said they would wait to see what the consultation concludes before deciding what to do next, though most agreed that the matter would not go away.</p>
<p>Ministers have so far declined to say when a decision will be made. A spokesperson said the government was listening to every view and would set out its plans in due course, once the evidence had been weighed.</p>`;

function page(title: string, site: string, published: string, body: string): string {
  return `<!doctype html><html lang="en-GB"><head><title>${title} | ${site}</title>
<meta property="og:title" content="${title}" />
<meta property="og:site_name" content="${site}" />
<meta property="article:published_time" content="${published}T08:00:00Z" />
</head><body><nav>Home News</nav><article><h1>${title}</h1>${body}${REPORT}</article><footer>© ${site}</footer></body></html>`;
}

const PAGES: Record<string, string> = {
  "https://www.examplegazette.co.uk/news/march": page(
    "Protesters march on Whitehall",
    "The Example Gazette",
    "2026-10-14",
    `<figure><img src="/march.jpg" alt="Marchers on Whitehall" />
<figcaption>Campaigners from PauseAI UK outside Downing Street. Photo: Jane Smith</figcaption></figure>
<p>Hundreds marched through London on Saturday calling for a pause on frontier AI.</p>`,
  ),
  "https://www.exampleweekly.com/founder": page(
    "Movement founder warns of AI risks",
    "Example Weekly",
    "2026-10-15",
    `<p>Maxime Fournes, chief executive of PauseAI Global, said governments must agree a pause on the most powerful AI.</p>`,
  ),
  "https://news.example.org/council-ai": page(
    "Council votes to pause AI chatbot pilot",
    "Example Local News",
    "2026-10-12",
    `<p>Councillors voted to pause AI chatbots in the housing office until the trial is reviewed.</p>`,
  ),
  "https://www.examplewire.com/seoul": page(
    "AI summit opens in Seoul",
    "Example Wire",
    "2026-10-13",
    `<p>Ministers from thirty countries met in Seoul to discuss the safety of frontier AI.</p>`,
  ),
  "https://www.exampletimes.com/rally": page(
    "Rally in Washington calls for AI limits",
    "The Example Times",
    "2026-10-10",
    `<p>The rally was organised by PauseAI US, which campaigns for limits on frontier AI in America.</p>`,
  ),
};

export const newsPagesFake: Fake = ({ href }) => {
  const html = PAGES[href];
  return html === undefined
    ? undefined
    : new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
};
