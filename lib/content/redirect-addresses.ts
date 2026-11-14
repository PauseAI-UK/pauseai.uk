// The addresses next.config.ts's redirects lead to, which the content they
// belong to takes from here too. A file of their own, as the build's
// settings run for every page: importing the content itself would make a
// change to any of its words a change to every page.

/** The march's page, the sign-up (march, ./march.ts). */
export const MARCH_PATH = "/protests/march-against-ai-extinction-nov-26";

/** The march's short link, which redirects to MARCH_PATH. */
export const MARCH_SHORT_PATH = "/march";

/** The first Email your MP campaign in priority order (campaigns, ./email-your-mp.ts), where plain /campaigns goes. */
export const FIRST_CAMPAIGN_SLUG = "regulate-letter-pm";
