// What kind of piece a find is, as /press labels it: a video, a set of
// photos or an article. Most coverage is articles, so that's the answer
// unless the page or its address says otherwise. Staff can change it.

import type { Medium } from "./coverage";
import { hostOf } from "./urls.ts";

/** Sites whose pages are videos. */
const VIDEO_SITES = ["youtube.com", "youtu.be", "vimeo.com", "tiktok.com", "dailymotion.com"];

/** Photo agencies' sites, whose pages are pictures for sale or licence. */
const PHOTO_SITES = [
  "imago-images.com",
  "reutersconnect.com",
  "gettyimages.com",
  "gettyimages.co.uk",
  "alamy.com",
  "shutterstock.com",
  "apimages.com",
  "eyevine.com",
  "zumapress.com",
];

/** A part of an address that's a video page's: /video/, /videos/, BBC's /av/, /watch. */
const VIDEO_PATH = /\/(videos?|av|watch|clips?)(\/|$)/i;

/** A part of an address that's a gallery's: /gallery/, /photos/, /in-pictures/ and the like. */
const PHOTO_PATH = /\/(galler(y|ies)|photos?|pictures|in-pictures|photo-?gallery|slideshows?)(\/|-|$)/i;

const onSite = (host: string, sites: string[]) => sites.some((site) => host === site || host.endsWith(`.${site}`));

/** The kind of piece at `url`, from its site, its address and `ogType`, the page's og:type if it was read. */
export function mediumOf(url: string, ogType?: string): Medium {
  const parsed = URL.canParse(url);
  const host = parsed ? hostOf(url) : "";
  const path = parsed ? new URL(url).pathname : "";
  if (onSite(host, VIDEO_SITES) || ogType?.toLowerCase().startsWith("video") || VIDEO_PATH.test(path)) return "Video";
  if (onSite(host, PHOTO_SITES) || PHOTO_PATH.test(path)) return "Photos";
  return "Article";
}
