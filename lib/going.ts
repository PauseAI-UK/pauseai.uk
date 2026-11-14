import { goingCopy } from "@/lib/content/going";

// Who's going to an event, as its page on luma.com shows anyone: how many,
// and the few guests Luma features (lib/server/outside-services/luma-public.server.ts).

/** A guest Luma features: their name, and their photo if next/image may show it. */
export type FeaturedGuest = { name: string; avatar: string | null };

export type EventGoing = { count: number; guests: FeaturedGuest[] };

/** How many guests goingNames names before "and N others", as Luma does. */
const NAMED = 2;

/** "Jane, Sam and 1,111 others", or, when Luma features everyone going, "Jane and Sam". */
export function goingNames({ count, guests }: EventGoing): string {
  const named = guests.slice(0, NAMED).map((guest) => guest.name);
  const others = count - named.length;
  if (others <= 0) return named.join(" and ");
  return `${named.join(", ")} and ${goingCopy.others(others.toLocaleString("en-GB"), others === 1)}`;
}
