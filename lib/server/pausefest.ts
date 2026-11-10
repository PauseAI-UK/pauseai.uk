import "server-only";
import { pausefest } from "@/lib/content/pausefest";
import { getEventGoing, type EventGoing } from "./outside-services/luma-public";

/** Who's going to each of PauseFest's events, by its Luma ID, asked of Luma all at once. */
export async function getPauseFestGoing(): Promise<Record<string, EventGoing | null>> {
  const ids = pausefest.days.flatMap((day) => day.events.map((event) => event.lumaId));
  const going = await Promise.all(ids.map(getEventGoing));
  return Object.fromEntries(ids.map((id, i) => [id, going[i]]));
}
