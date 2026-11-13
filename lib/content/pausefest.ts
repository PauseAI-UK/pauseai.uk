// PauseFest, 20–23 November 2026: four days of action in London around the
// March Against AI Extinction, for its page (app/(site)/pausefest-london-2026).
// The events, times and places are the PauseAI UK Luma calendar's, the words
// its flyer's.
import type { EventGoing } from "@/lib/going";
import { march } from "./march";

export type FestEvent = {
  title: string;
  /** As people say it, in UK time: "6–9pm". Luma's times replace it, where Luma can say. */
  time: string;
  place: string;
  /** Where people register: the event on Luma, or the march's own sign-up. */
  href: string;
  /** The event's ID on Luma, for its times and who's going. */
  lumaId: string;
  /** Whether who's going is left unshown, as for an event people apply to. */
  hideGuests?: boolean;
  /** What a featured event's button says, when not "Register". */
  button?: string;
  /** The event's cover, square, shown beside a featured event. */
  image: string;
  /** One of the festival's main events, given a band of its own. */
  featured?: boolean;
  /** Smaller events that go with this one, such as the buses to the march. */
  extras?: { label: string; href: string }[];
};

/** What Luma says of an event as the page is drawn: its times, and who's going where shown. Null where Luma can't say. */
export type FestLive = { time: string | null; going: EventGoing | null };

export type FestDay = {
  /** As the poster gives it: "Fri 20 Nov". */
  short: string;
  events: FestEvent[];
};

export const pausefest: {
  name: string;
  path: string;
  tagline: string;
  days: FestDay[];
} = {
  name: "PauseFest",
  path: "/pausefest-london-2026",
  tagline: "Four days of action in London, 20–23 November",
  days: [
    {
      short: "Fri 20 Nov",
      events: [
        {
          title: "Sign-making",
          time: "6–9pm",
          place: "Waterloo Action Centre, SE1 7AB",
          href: "https://luma.com/5na05tdu",
          lumaId: "evt-uvhJhYEEPh6UM9Z",
          image: "https://images.lumacdn.com/event-covers/8i/8069c3db-3f82-4014-b7b3-53e8f0780fe7.jpg",
        },
      ],
    },
    {
      short: "Sat 21 Nov",
      events: [
        {
          title: march.name,
          time: "12–3pm",
          place: "All Souls’ Place, W1B 3DA",
          href: march.path,
          lumaId: "evt-1HKCXSHaJqGO3Bg",
          image: march.image.src,
          featured: true,
          extras: [
            { label: "Bus from Oxford", href: "https://luma.com/2iot5awn" },
            { label: "Bus from Bristol", href: "https://luma.com/w7zhy767" },
          ],
        },
      ],
    },
    {
      short: "Sun 22 Nov",
      events: [
        {
          title: "Flyering for the next march",
          time: "12–4pm",
          place: "Waterloo Action Centre, SE1 7AB",
          href: "https://luma.com/pauseai-3yc9",
          lumaId: "evt-EZYMdCaJRsMDDoy",
          image: "https://images.lumacdn.com/uploads/nz/938248d8-0857-49a7-9c9f-4af48f40be6b.png",
        },
      ],
    },
    {
      short: "Mon 23 Nov",
      events: [
        {
          title: "Conference in Parliament",
          time: "9.30am–1.30pm",
          place: "Palace of Westminster",
          href: "https://luma.com/pauseai-conf-nov26",
          lumaId: "evt-p2EKwf3Bu0Zo5Xz",
          button: "Apply",
          hideGuests: true,
          image: "https://images.lumacdn.com/uploads/t2/6f9c5a2e-8e76-41a6-9fc2-2627399cc8a2.png",
          featured: true,
        },
        {
          title: "Fireside chat with Siliconversations",
          time: "6–9pm",
          place: "Central Foundation Boys’ School, EC2A 4SH",
          href: "https://luma.com/ke76bqjf",
          lumaId: "evt-VO43kEPXGcHCl0l",
          image: "https://images.lumacdn.com/uploads/xa/ce83a427-a7f4-44c2-8cde-74e7f53b80e4.png",
        },
      ],
    },
  ],
};
