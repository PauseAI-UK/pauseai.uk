// The Marches Against AI Extinction, each one's facts in one place, for the
// marches' pages (app/(march)/): `march` is the next one, whose page is the
// sign-up, and `novemberMarch` the one before, whose page is a record of it.
// The sign-up's link preview shows its date and time: after changing them,
// run `npm run march:preview`.
import { MARCH_PATH } from "./redirect-addresses";
import { site } from "./site";

/** Where a march starts or ends. */
export type MarchStop = {
  name: string;
  /** The rest of its address, after its name. */
  area: string;
  postcode: string;
};

export type March = {
  name: string;
  /** The march's page. */
  path: string;
  /** The Luma event, where people register. */
  lumaUrl: string;
  startAt: string;
  endAt: string;
  /** Where it starts and ends: null until that's settled. */
  route: { start: MarchStop; end: MarchStop } | null;
  /** The date and place as the march's page shows them. */
  dateLong: string;
  dateShort: string;
  /** Written out, as the turnout figures' dates are. */
  dateWritten: string;
  /** For <time dateTime>. */
  dateIso: string;
  time: string;
  city: string;
  /** A picture of it, for search engines' event listings. */
  image: string;
};

/** The march of 21 November 2026. */
export const novemberMarch: March = {
  name: "March Against AI Extinction",
  path: "/demonstrations/march-against-ai-extinction-nov-26",
  lumaUrl: "https://luma.com/pauseai-nov26",
  startAt: "2026-11-21T12:00:00Z",
  endAt: "2026-11-21T15:00:00Z",
  route: {
    start: { name: "All Souls' Place", area: "London W1B 3DA", postcode: "W1B 3DA" },
    end: { name: "Downing Street", area: "London SW1A 2AA", postcode: "SW1A 2AA" },
  },
  dateLong: "Saturday 21st November, 2026",
  dateShort: "Sat 21 Nov 2026",
  dateWritten: "21st November 2026",
  dateIso: "2026-11-21",
  time: "12:00 PM - 3:00 PM",
  city: "Central London",
  // The Luma event's cover photo.
  image: "/images/march-nov-26/luma-cover.webp",
};

/** The film of the November 2026 march, for its page and the track record: the file, and a photo of the march to show until it's played. */
export const novemberMarchFilm = {
  src: "/videos/march-against-ai-extinction-nov-26.mp4",
  poster: "/images/march-nov-26/film-poster.jpg",
  label: "Film of the March Against AI Extinction, 21 November 2026",
};

/**
 * The next march, 10 April 2027, 12pm to 3pm in London (BST), as its Luma
 * event has it. Its route isn't settled.
 */
export const march: March = {
  name: "March Against AI Extinction",
  path: MARCH_PATH,
  lumaUrl: "https://luma.com/pauseai-april-27",
  startAt: "2027-04-10T11:00:00Z",
  endAt: "2027-04-10T14:00:00Z",
  route: null,
  dateLong: "Saturday 10th April, 2027",
  dateShort: "Sat 10 Apr 2027",
  dateWritten: "10th April 2027",
  dateIso: "2027-04-10",
  time: "12:00 PM - 3:00 PM",
  city: "London",
  // The sign-up's hero photo.
  image: "/images/march-signup/hero-march.jpg",
};

/**
 * schema.org Event data for a march's page, so search engines can show it
 * as an event (https://developers.google.com/search/docs/appearance/structured-data/event).
 * Its place is where it starts, or London alone while the route isn't settled.
 */
export function marchEventJsonLd(of: March): Record<string, unknown> {
  const start = of.route?.start;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: of.name,
    startDate: of.startAt,
    endDate: of.endAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: start ? start.name : "London",
      address: {
        "@type": "PostalAddress",
        ...(start && { streetAddress: start.name, postalCode: start.postcode }),
        addressLocality: "London",
        addressCountry: "GB",
      },
    },
    image: [`${site.url}${of.image}`],
    description:
      "Thousands of people across the UK believe that companies will soon build superintelligent AI that they cannot control.",
    organizer: { "@type": "Organization", name: "PauseAI UK", url: site.url },
    offers: {
      "@type": "Offer",
      url: of.lumaUrl,
      price: "0",
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
    },
    url: `${site.url}${of.path}/`,
  };
}
