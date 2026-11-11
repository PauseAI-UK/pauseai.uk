// The browser and operating system a User-Agent header names: names alone
// for the page of a staff member's sessions, and the browser's with its
// version for an error a browser reports. Checked in an order that matters,
// as most browsers name others too (Edge says Chrome and Safari; Chrome
// says Safari; iPhones say Mac OS X).

/** Each browser's mark in a User-Agent, its first group the version's first number. */
const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/\b(?:OPR|Opera)\/(\d+)/, "Opera"],
  [/\bSamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/\b(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/\b(?:Chrome|CriOS|HeadlessChrome)\/(\d+)/, "Chrome"],
  [/\bVersion\/(\d+)[\d.]*.*\bSafari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/\biPhone\b/, "iOS"],
  [/\biPad\b/, "iPadOS"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bWindows\b/, "Windows"],
  [/\b(Macintosh|Mac OS X)\b/, "macOS"],
  [/\bLinux\b/, "Linux"],
];

const first = (list: [RegExp, string][], userAgent: string | null) =>
  userAgent ? list.find(([pattern]) => pattern.test(userAgent))?.[1] : undefined;

/** The browser a User-Agent names ("Firefox"), if it's one we know. */
export function browserOf(userAgent: string | null): string | undefined {
  return first(BROWSERS, userAgent);
}

/** The browser a User-Agent names and its version's first number ("Firefox 131"), if it's one we know. */
export function browserVersionOf(userAgent: string | null): string | undefined {
  for (const [pattern, name] of BROWSERS) {
    const version = pattern.exec(userAgent ?? "")?.[1];
    if (version) return `${name} ${version}`;
  }
  return undefined;
}

/** The operating system a User-Agent names ("macOS"), if it's one we know. */
export function systemOf(userAgent: string | null): string | undefined {
  return first(SYSTEMS, userAgent);
}
