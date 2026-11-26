// The homepage's scrolling press logos: outlets with a strong, official,
// recognisable logo, one each, balanced across political lean rather than
// every outlet with a logo. Each links to the outlet's newest piece on
// /press. The coverage itself is in the database (lib/press/), which the
// homepage doesn't read, so it stays a page built in advance.

/** An outlet's logo on the homepage, and the place on /press it links to. */
export type PressLogo = {
  outlet: string;
  /** The logo, a file under public/. */
  logoSrc: string;
  /** The height it's drawn at on a desktop, chosen so every mark carries about the same area. */
  logoHeight: number;
  /** The file's own size, which next/image needs for its shape. */
  logoIntrinsicWidth: number;
  logoIntrinsicHeight: number;
};

/** The id of an outlet's place on /press, which its logo links to: "the-guardian". */
export function outletAnchor(outlet: string): string {
  return outlet
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The logos, in the order they scroll. */
const PRESS_LOGOS: PressLogo[] = [
  {
    outlet: "Financial Times",
    logoSrc: "/images/media-coverage/Financial_Times_corporate_logo.svg",
    logoHeight: 56,
    logoIntrinsicWidth: 228,
    logoIntrinsicHeight: 311,
  },
  {
    outlet: "Wall Street Journal",
    logoSrc: "/images/media-coverage/wall-street-journal-logo.png",
    logoHeight: 26,
    logoIntrinsicWidth: 777,
    logoIntrinsicHeight: 67,
  },
  {
    outlet: "Business Insider",
    logoSrc: "/images/media-coverage/Business_Insider_Logo.svg",
    logoHeight: 43,
    logoIntrinsicWidth: 103,
    logoIntrinsicHeight: 32,
  },
  {
    outlet: "TIME",
    logoSrc: "/images/media-coverage/Time_Magazine_logo.svg",
    logoHeight: 42,
    logoIntrinsicWidth: 298,
    logoIntrinsicHeight: 92,
  },
  {
    outlet: "Fortune",
    logoSrc: "/images/media-coverage/Fortune_magazine_logo.svg",
    logoHeight: 37,
    logoIntrinsicWidth: 90,
    logoIntrinsicHeight: 21,
  },
  {
    outlet: "MIT Technology Review",
    logoSrc: "/images/media-coverage/MIT_Technology_Review_modern_logo.svg",
    logoHeight: 54,
    logoIntrinsicWidth: 184,
    logoIntrinsicHeight: 92,
  },
  {
    outlet: "The Guardian",
    logoSrc: "/images/media-coverage/The_Guardian_Logo.svg",
    logoHeight: 44,
    logoIntrinsicWidth: 295,
    logoIntrinsicHeight: 97,
  },
  {
    outlet: "BBC",
    logoSrc: "/images/media-coverage/BBC_Logo_2021.svg",
    logoHeight: 40,
    logoIntrinsicWidth: 560,
    logoIntrinsicHeight: 160,
  },
  {
    outlet: "The Independent",
    logoSrc: "/images/media-coverage/The_Independent_Logo.png",
    logoHeight: 26,
    logoIntrinsicWidth: 540,
    logoIntrinsicHeight: 38,
  },
  {
    outlet: "Daily Mail",
    logoSrc: "/images/media-coverage/Daily_Mail_masthead.svg",
    logoHeight: 31,
    logoIntrinsicWidth: 1000,
    logoIntrinsicHeight: 158,
  },
  {
    outlet: "Channel 4",
    logoSrc: "/images/media-coverage/Channel_4_logo.svg",
    logoHeight: 56,
    logoIntrinsicWidth: 178,
    logoIntrinsicHeight: 240,
  },
  {
    outlet: "ITV",
    logoSrc: "/images/media-coverage/ITV_logo.svg",
    logoHeight: 46,
    logoIntrinsicWidth: 1000,
    logoIntrinsicHeight: 368,
  },
  {
    outlet: "Vox",
    logoSrc: "/images/media-coverage/Vox_logo.svg",
    logoHeight: 52,
    logoIntrinsicWidth: 120,
    logoIntrinsicHeight: 58,
  },
  {
    outlet: "GB News",
    logoSrc: "/images/media-coverage/GB_News_logo.png",
    logoHeight: 28,
    logoIntrinsicWidth: 1240,
    logoIntrinsicHeight: 164,
  },
  {
    outlet: "TalkTV",
    logoSrc: "/images/media-coverage/TalkTV_logo.png",
    logoHeight: 52,
    logoIntrinsicWidth: 873,
    logoIntrinsicHeight: 778,
  },
];

/**
 * `items` repeated until there are at least `minLength`. The marquee loops
 * by drawing a row twice side by side and scrolling by half, which is
 * seamless only if one copy is wider than the screen, so a short row is
 * repeated rather than the logos cut to fit.
 */
export function tileToMinLength<T>(items: T[], minLength: number): T[] {
  if (items.length === 0) return items;
  const tiled: T[] = [];
  while (tiled.length < minLength) tiled.push(...items);
  return tiled;
}

const half = Math.ceil(PRESS_LOGOS.length / 2);
const third = Math.ceil(PRESS_LOGOS.length / 3);

/** Two rows on a desktop. */
export const newsRow1 = tileToMinLength(PRESS_LOGOS.slice(0, half), 14);
export const newsRow2 = tileToMinLength(PRESS_LOGOS.slice(half), 14);

/** Three shorter rows on a phone, each easier to scan on a narrow screen. */
export const newsMobileRow1 = tileToMinLength(PRESS_LOGOS.slice(0, third), 10);
export const newsMobileRow2 = tileToMinLength(PRESS_LOGOS.slice(third, third * 2), 10);
export const newsMobileRow3 = tileToMinLength(PRESS_LOGOS.slice(third * 2), 10);
