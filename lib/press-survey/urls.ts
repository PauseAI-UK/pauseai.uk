// URLs as the survey compares them. Two links to one article differ in
// tracking parameters, an AMP copy, a fragment, `www.` or a trailing slash;
// `cleanUrl` drops what a link shouldn't carry, and `urlKey` drops the rest,
// for comparing.

const TRACKING = /^(utm_.*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|ocid|cmpid|guccounter|ito|amp)$/i;

/** The link without tracking parameters, fragment or AMP, or undefined for one that isn't http(s). */
export function cleanUrl(link: string): string | undefined {
  if (!URL.canParse(link)) return undefined;
  const url = new URL(link);
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  url.hash = "";
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING.test(name) || (name === "outputType" && url.searchParams.get(name) === "amp")) {
      url.searchParams.delete(name);
    }
  }
  url.hostname = url.hostname.toLowerCase().replace(/^amp\./, "");
  url.pathname = url.pathname.replace(/\/amp\/?$|\.amp$/, "").replace(/\/amp\//, "/") || "/";
  return url.toString();
}

/** The site an article is on, without `www.`. */
export function hostOf(link: string): string {
  return new URL(link).hostname.toLowerCase().replace(/^www\./, "");
}

/** What two links to the same article share, or undefined for one that isn't http(s). */
export function urlKey(link: string): string | undefined {
  const clean = cleanUrl(link);
  if (!clean) return undefined;
  const url = new URL(clean);
  url.searchParams.sort();
  const path = url.pathname.replace(/\/+$/, "");
  return `${hostOf(clean)}${path}${url.search}`;
}

/** The keys of every http(s) link written anywhere in `text`. */
export function linksIn(text: string): Set<string> {
  const keys = new Set<string>();
  for (const [link] of text.matchAll(/https?:\/\/[^\s"'`<>)\]]+/g)) {
    const key = urlKey(link);
    if (key) keys.add(key);
  }
  return keys;
}
