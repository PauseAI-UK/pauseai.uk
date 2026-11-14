import "server-only";
import { pausefest, type FestLive } from "@/lib/content/pausefest";
import { timeRange } from "@/lib/time-range";
import { getPublicEvent } from "@/lib/server/outside-services/luma-public";

/**
 * What Luma says of each of PauseFest's events, by its Luma ID, asked all at
 * once: its times, and who's going unless its guests are hidden.
 */
export async function getPauseFestLive(): Promise<Record<string, FestLive>> {
  const events = pausefest.days.flatMap((day) => day.events);
  const live = await Promise.all(events.map((event) => getPublicEvent(event.lumaId)));
  return Object.fromEntries(
    events.map((event, i) => {
      const { startAt = null, endAt = null, going = null } = live[i] ?? {};
      return [
        event.lumaId,
        {
          time: startAt && endAt ? timeRange(startAt, endAt) : null,
          going: event.hideGuests ? null : going,
        },
      ];
    }),
  );
}
