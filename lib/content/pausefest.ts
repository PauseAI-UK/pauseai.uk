// PauseFest, 20–23 November 2026: four days of action in London around the
// March Against AI Extinction, for its page (app/(site)/pausefest-london-2026). The
// events, times and places are the PauseAI UK Luma calendar's.
import { march } from "./march";

export type FestEvent = {
  title: string;
  /** As people say it, in UK time: "6–9pm". */
  time: string;
  place: string;
  blurb: string;
  /** Where people register: the event on Luma, or the march's own sign-up. */
  href: string;
  /** The event's cover, square. */
  image: string;
  /** The day's main event, shown larger. */
  featured?: boolean;
  /** Smaller events that go with this one, such as the buses to the march. */
  extras?: { label: string; href: string }[];
};

export type FestDay = {
  /** The day's anchor on the page. */
  id: string;
  weekday: string;
  date: string;
  events: FestEvent[];
};

export const pausefest: { name: string; path: string; tagline: string; days: FestDay[] } = {
  name: "PauseFest",
  path: "/pausefest-london-2026",
  tagline: "Four days of action in London, 20–23 November",
  days: [
    {
      id: "fri-20",
      weekday: "Fri",
      date: "20 Nov",
      events: [
        {
          title: "Sign-making",
          time: "6–9pm",
          place: "Waterloo Action Centre, SE1 7AB",
          blurb: "Come and make a sign for the big march the next day!",
          href: "https://luma.com/5na05tdu",
          image: "https://images.lumacdn.com/event-covers/8i/8069c3db-3f82-4014-b7b3-53e8f0780fe7.jpg",
        },
      ],
    },
    {
      id: "sat-21",
      weekday: "Sat",
      date: "21 Nov",
      events: [
        {
          title: march.name,
          time: "12–3pm",
          place: "All Souls’ Place, W1B 3DA, to Downing Street",
          blurb: "Calling for frontier AI legislation",
          href: march.path,
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
      id: "sun-22",
      weekday: "Sun",
      date: "22 Nov",
      events: [
        {
          title: "Flyering in London",
          time: "12–4pm",
          place: "Waterloo Action Centre, SE1 7AB",
          blurb: "The day after the biggest ever March Against AI Extinction, we begin canvassing for the next march.",
          href: "https://luma.com/pauseai-3yc9",
          image: "https://images.lumacdn.com/uploads/nz/938248d8-0857-49a7-9c9f-4af48f40be6b.png",
        },
      ],
    },
    {
      id: "mon-23",
      weekday: "Mon",
      date: "23 Nov",
      events: [
        {
          title: "Conference in Parliament",
          time: "9:30am–1:30pm",
          place: "Palace of Westminster, SW1A 0AA",
          blurb: "Have your questions answered by prominent figures in UK AI policy.",
          href: "https://luma.com/pauseai-conf-nov26",
          image: "https://images.lumacdn.com/uploads/t2/6f9c5a2e-8e76-41a6-9fc2-2627399cc8a2.png",
        },
        {
          title: "Fireside chat with YouTuber Siliconversations",
          time: "6–9pm",
          place: "Central Foundation Boys’ School, EC2A 4SH",
          blurb: "How to build the creator ecosystem that AI safety needs. Pizza provided.",
          href: "https://luma.com/ke76bqjf",
          image: "https://images.lumacdn.com/uploads/xa/ce83a427-a7f4-44c2-8cde-74e7f53b80e4.png",
        },
      ],
    },
  ],
};
