import { BRIEFINGS, briefings } from "@/lib/content/briefings";
import { newestFirst } from "@/lib/content/posts";
import { postsFeed } from "@/lib/content/posts-feed";

export const dynamic = "force-static";

/** The weekly briefings' Atom feed, every briefing newest first. */
export function GET(): Response {
  return new Response(postsFeed(newestFirst(briefings), BRIEFINGS), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
