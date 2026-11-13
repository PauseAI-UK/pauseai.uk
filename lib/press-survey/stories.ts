// From leads to stories. The same article turns up from more than one
// search, and the same story from more than one outlet, often under the
// same headline (a wire piece, a syndicated copy). A story is the leads
// whose headlines match once punctuation, case and accents are set aside.

import type { Lead } from "./sources.ts";
import { urlKey } from "./urls.ts";

export type Story = {
  /** The lead the story is judged on: the first with the article's own URL, else the first. */
  lead: Lead;
  /** The other outlets' copies. */
  others: Lead[];
};

/** A headline as stories are matched on: lower case, without accents, punctuation or an outlet's name after " - " or " | ". */
export function titleKey(title: string): string {
  return title
    .replace(/\s+[-|–—]\s+[^-|–—]+$/, "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Whether `lead` is from a UK outlet, as GDELT says or its domain does. */
export function isUk(lead: Lead): boolean {
  return lead.country === "United Kingdom" || /\.uk$/.test(lead.domain);
}

/**
 * The leads as stories, in the order their first lead came, leaving out
 * any lead whose URL is in `known` and any story one of whose copies is
 * (a story already in the file under another outlet's copy is still known).
 */
export function stories(leads: Lead[], known: Set<string>): Story[] {
  const byUrl = new Map<string, Lead>();
  for (const lead of leads) {
    const key = urlKey(lead.url) as string;
    if (!byUrl.has(key)) byUrl.set(key, lead);
  }

  const groups = new Map<string, { leads: Lead[]; known: boolean }>();
  for (const [key, lead] of byUrl) {
    const title = titleKey(lead.title) || key;
    const group = groups.get(title) ?? { leads: [], known: false };
    group.leads.push(lead);
    group.known ||= known.has(key);
    groups.set(title, group);
  }

  return [...groups.values()]
    .filter((group) => !group.known)
    .map(({ leads: copies }) => {
      const direct = copies.filter((lead) => lead.direct);
      const lead = direct.find(isUk) ?? direct[0] ?? copies[0];
      return { lead, others: copies.filter((copy) => copy !== lead) };
    });
}
