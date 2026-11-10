import "server-only";
import { isAllowedEventImage } from "@/lib/event-image-hosts";
import { staffCopy } from "@/lib/content/staff-interface";
import { problem } from "../problems";
import { outsideFetch } from "./outside-fetch";

// Who's going to an event, as its page on luma.com shows anyone: how many,
// and the few guests Luma features, from the data that page loads. Luma
// leaves out of those anyone who has hidden themselves from guest lists,
// which the official API, listing every guest, can't do.

/** A guest Luma features: their name, and their photo if next/image may show it. */
export type FeaturedGuest = { name: string; avatar: string | null };

export type EventGoing = { count: number; guests: FeaturedGuest[] };

type ApiGuest = { name?: string | null; avatar_url?: string | null } | null;

/** How long Next keeps an event's guests before asking Luma again, in seconds. */
const GOING_REVALIDATE = 300;

/**
 * How many are going to an event and who Luma features, cached for five
 * minutes, so however many visitors ask, Luma is asked about that often. A
 * featured guest without a name is left out. Null when Luma errs or gives
 * no count, so the page shows nothing rather than a misleading zero.
 */
export async function getEventGoing(eventId: string): Promise<EventGoing | null> {
  try {
    const res = await outsideFetch(`https://api.lu.ma/event/get?${new URLSearchParams({ event_api_id: eventId })}`, {
      headers: { accept: "application/json" },
      next: { revalidate: GOING_REVALIDATE },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { guest_count?: unknown; featured_guests?: ApiGuest[] };
    if (typeof data.guest_count !== "number") return null;
    return {
      count: data.guest_count,
      guests: (data.featured_guests ?? []).flatMap((guest) =>
        guest?.name
          ? [
              {
                name: guest.name,
                avatar: guest.avatar_url && isAllowedEventImage(guest.avatar_url) ? guest.avatar_url : null,
              },
            ]
          : [],
      ),
    };
  } catch (error) {
    problem(staffCopy.problems.logs.lumaGuestsDown, error);
    return null;
  }
}
