// ControlAI's UK campaign statement, which politicians back on its page. The
// page names no one in its text: each supporter is a link to their profile
// on their body's site, by the ID their body gives them (Parliament's and
// the NI Assembly's) or by their name (the Scottish Parliament's and the
// Senedd's). lib/server/controlai-statement-import.ts copies them in
// nightly, as the statuses of the statement's ask; this reads the links.

import type { Body } from "@/lib/politicians/import-changes";

export const CONTROLAI_STATEMENT_PAGE = "https://controlai.org/statement";

/** One supporter as the page links to them: by their body's ID for them, or the name in their page's address. */
export type StatementSupporter = { body: Body; id: number; link: string } | { body: Body; slug: string; link: string };

const LINKS: { body: Body; pattern: RegExp; by: "id" | "slug" }[] = [
  { body: "parliament", pattern: /^https?:\/\/members\.parliament\.uk\/member\/(\d+)/i, by: "id" },
  {
    body: "ni-assembly",
    pattern: /^https?:\/\/aims\.niassembly\.gov\.uk\/mlas\/details\.aspx\?.*\bper=(\d+)/i,
    by: "id",
  },
  {
    body: "scottish-parliament",
    pattern: /^https?:\/\/(?:www\.)?parliament\.scot\/msps\/current-and-previous-msps\/([a-z0-9-]+)/i,
    by: "slug",
  },
  {
    body: "senedd",
    pattern: /^https?:\/\/(?:www\.)?senedd\.(?:wales|cymru)\/people\/([a-z0-9-]+?)(?:-ms|-as)?\/?$/i,
    by: "slug",
  },
];

/** The supporters a page links to, each once, however many links it has to them. */
export function statementSupporters(html: string): StatementSupporter[] {
  const seen = new Map<string, StatementSupporter>();
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    const link = href.replace(/&amp;/g, "&");
    for (const { body, pattern, by } of LINKS) {
      const found = link.match(pattern)?.[1];
      if (!found) continue;
      const key = `${body} ${found.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, by === "id" ? { body, id: Number(found), link } : { body, slug: found.toLowerCase(), link });
      }
    }
  }
  return [...seen.values()];
}

/** A name as it is in a page's address: "Peredur Owen Griffiths" is peredur-owen-griffiths, "Fulton MacGregor" fulton-macgregor. */
export function nameSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
