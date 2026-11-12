// What the weekly survey of PauseAI UK's coverage searches for. The names
// are the spokespeople that lib/content/press-coverage.ts's entries quote
// for each organisation, so a piece quoting one is read as being about it.

import type { People } from "./signals.ts";

export const PEOPLE: People = {
  uk: ["Joseph Miller", "Tom Bibby", "Ella Hughes", "Alistair Stewart"],
  global: ["Maxime Fournes"],
  us: ["Holly Elmore"],
};

/**
 * GDELT searches. Each is run worldwide, which takes in UK outlets, and
 * again for UK outlets alone only if the worldwide one fills GDELT's 250.
 * A query naming a spokesperson beside "Pause AI" would find nothing this
 * one doesn't, as GDELT searches the whole text.
 */
export const GDELT_QUERIES = ['("PauseAI" OR "Pause AI")'];

/** The most articles GDELT gives for one search. */
export const GDELT_MOST = 250;

/** Google News searches, each for the last week. */
export const GOOGLE_NEWS_QUERIES = ['"PauseAI" OR "Pause AI"', '"PauseAI UK" OR "Pause AI UK"', '"Joseph Miller" AI'];

/** How many stories' pages to read, highest ranked first. */
export const MOST_PAGES = 40;

/**
 * Sites where many outlets post, or copy others' pieces, so a link there
 * doesn't say whose coverage it is, unlike an outlet's own site.
 */
export const SHARED_SITES = [
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "x.com",
  "twitter.com",
  "facebook.com",
  "tiktok.com",
  "open.spotify.com",
  "aol.co.uk",
  "aol.com",
  "msn.com",
  "yahoo.com",
  "uk.news.yahoo.com",
  "news.google.com",
  "reutersconnect.com",
];
