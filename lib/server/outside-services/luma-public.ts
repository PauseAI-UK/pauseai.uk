import "server-only";
import { isAllowedEventImage } from "@/lib/event-image-hosts";
import { staffCopy } from "@/lib/content/staff-interface";
import { problem } from "../problems";
import type { EventGoing } from "@/lib/going";
import { outsideFetch } from "./outside-fetch";

// An event as its page on luma.com shows anyone, from the data that page
// loads: when it starts and ends, how many are going, and the few guests
// Luma features. Luma leaves out of those anyone who has hidden themselves
// from guest lists, which the official API, listing every guest, can't do.

/** An event's page on luma.com, as far as the site reads it. */
export type PublicEvent = {
  /** When it starts and ends, as ISO timestamps; null where Luma gives none. */
  startAt: string | null;
  endAt: string | null;
  /** Null when Luma gives no count, so the page shows nothing rather than a misleading zero. */
  going: EventGoing | null;
};

type ApiGuest = { name?: string | null; avatar_url?: string | null } | null;

type ApiEvent = {
  guest_count?: unknown;
  featured_guests?: ApiGuest[];
  event?: { start_at?: unknown; end_at?: unknown };
};

/** How long Next keeps an event's page before asking Luma again, in seconds. */
const EVENT_REVALIDATE = 300;

/** The timestamp, if Luma gave one. */
function timestamp(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** How many are going and who Luma features, a featured guest without a name left out. */
function going(data: ApiEvent): EventGoing | null {
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
}

/**
 * An event as its page on luma.com shows it, cached for five minutes, so
 * however many visitors ask, Luma is asked about that often. Null when
 * Luma errs.
 */
export async function getPublicEvent(eventId: string): Promise<PublicEvent | null> {
  try {
    const res = await outsideFetch(`https://api.lu.ma/event/get?${new URLSearchParams({ event_api_id: eventId })}`, {
      headers: { accept: "application/json" },
      next: { revalidate: EVENT_REVALIDATE },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ApiEvent;
    return { startAt: timestamp(data.event?.start_at), endAt: timestamp(data.event?.end_at), going: going(data) };
  } catch (error) {
    problem(staffCopy.problems.logs.lumaGuestsDown, error);
    return null;
  }
}

/** How many are going to an event and who Luma features: null when Luma errs or gives no count. */
export async function getEventGoing(eventId: string): Promise<EventGoing | null> {
  return (await getPublicEvent(eventId))?.going ?? null;
}
