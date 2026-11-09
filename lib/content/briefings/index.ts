import type { ReactNode } from "react";
import type { CalendarDay } from "@/components/briefings/WeekCalendar";
import { checkPostAuthors, type BlogPost, type PostSection } from "../posts";
import aiNewsWeeklyBriefing23rd30thOctober from "./ai-news-weekly-briefing-23rd-30th-october";

// The campaigns' briefings: a week's news each, laid out as their designer
// lays out the A4 briefing (components/briefings/), with its sources as
// numbered notes at the end. A briefing a file, ./<slug>.tsx, written with
// ./define.tsx and listed here newest first.

export const BRIEFINGS: PostSection = {
  path: "/campaigns/briefings",
  backLink: "← All briefings",
  moreHeading: "More briefings",
  feedTitle: "PauseAI UK Weekly briefings",
};

/** One of the week's key stories: its headline, in bold, and the rest. */
export type KeyStory = { lead: string; body: ReactNode };

/**
 * A briefing: a post with the week it covers, as a calendar in its
 * masthead, and its key stories, which head it and the list of briefings.
 * Its summary (`tldr`) is the key stories' headlines.
 */
export type Briefing = BlogPost & { week: CalendarDay[]; keyStories: KeyStory[] };

export const briefings: Briefing[] = [aiNewsWeeklyBriefing23rd30thOctober];

checkPostAuthors(briefings);

export function findBriefing(slug: string): Briefing | undefined {
  return briefings.find((briefing) => briefing.slug === slug);
}
