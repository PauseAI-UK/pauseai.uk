import { onParliamentDomain } from "./one-off";

// Politicians' names as the imports match them, and the domains of their own
// that their bodies list, which say whose a one-off thread is
// (lib/server/politician-import.ts).

const TITLES = /^(?:(?:the\s+)?rt\.?\s+hon\.?|mr|mrs|ms|miss|mx|dr|sir|dame|prof(?:essor)?|lord|lady)\.?\s+/i;

/** A name without titles, spacing or case: "Dr Ellie Chowns" and "Ellie Chowns" match. */
export function plainName(name: string): string {
  let plain = name.trim().replace(/\s+MP$/i, "");
  while (TITLES.test(plain)) plain = plain.replace(TITLES, "");
  return plain.replace(/\s+/g, " ").toLowerCase();
}

/**
 * The names of domains that say nothing of whose a thread is: social media,
 * link pages, parties, and mail anyone can have. Each is shared whatever its
 * ending (sinnfein.ie as much as sinnfein.org).
 */
const SHARED_NAMES = [
  "facebook",
  "twitter",
  "x",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "threads",
  "bsky",
  "linktr",
  "wordpress",
  "wixsite",
  "gmail",
  "googlemail",
  "hotmail",
  "outlook",
  "live",
  "msn",
  "yahoo",
  "icloud",
  "aol",
  "btinternet",
  "btopenworld",
  "sky",
  "virginmedia",
  "ntlworld",
  "talktalk",
  "tiscali",
  "mail",
  "gmx",
  "proton",
  "protonmail",
  "tuta",
  "tutanota",
  "labour",
  "conservatives",
  "libdems",
  "greenparty",
  "greens",
  "scottishgreens",
  "snp",
  "plaid",
  "partyof",
  "reform",
  "reformparty",
  "reformuk",
  "dup",
  "sinnfein",
  "alliance",
  "allianceparty",
  "sdlp",
  "uup",
  "tuv",
  "alba",
];

const SHARED_DOMAIN = new RegExp(`(^|\\.)(${SHARED_NAMES.join("|")})(\\.[a-z]{2,}){1,2}$`);

/**
 * Shared domains by their whole name: Apple's mail, as me.uk is anyone's own,
 * and the public sector's, as a minister's department, a council or a
 * university is no one person's.
 */
const SHARED_WHOLE = /^(me|mac)\.com$|\.(gov|ac|nhs|police|sch|mod)\.uk$|(^|\.)gov\.(scot|wales)$|\.(gov|edu)$/;

/**
 * A web or email address's domain, without a leading www, lowercased;
 * undefined if it has none. A web address with an @ in its path (a TikTok
 * handle) is a web address, so its domain is the site's.
 */
export function domainOf(address: string): string | undefined {
  const text = address.trim().toLowerCase();
  const domain = /^[^\s@/]+@[^\s@/]+$/.test(text)
    ? text.slice(text.indexOf("@") + 1)
    : text.replace(/^[a-z]+:\/\//, "").split(/[/?#@]/)[0];
  return domain.includes(".") ? domain.replace(/^www\./, "") : undefined;
}

/** Whether a domain is shared, so says nothing of whose an address on it is. */
export function isSharedDomain(domain: string): boolean {
  return SHARED_DOMAIN.test(domain) || SHARED_WHOLE.test(domain) || onParliamentDomain(`x@${domain}`);
}

/**
 * Each domain of a politician's own, by their ID, from their listed email
 * and web addresses: not a parliament's, a party's or social media, and held
 * by only one of them.
 */
export function ownDomains(people: { id: number; addresses: string[] }[]): Map<string, number> {
  const holders = new Map<string, Set<number>>();
  for (const { id, addresses } of people) {
    for (const address of addresses) {
      const domain = domainOf(address);
      if (!domain || isSharedDomain(domain)) continue;
      holders.set(domain, (holders.get(domain) ?? new Set()).add(id));
    }
  }
  return new Map([...holders].filter(([, ids]) => ids.size === 1).map(([domain, ids]) => [domain, [...ids][0]]));
}
