import type { Guest } from "@/lib/events/event-page.server";

// Example guests of an event for its page's gallery entries and browser
// tests: one of each status on Luma, one linked to their supporter, one
// with no name on Luma, and only some with a postcode, a phone or the link
// they came by.

const guest = (id: string, more: Partial<Guest>): Guest => ({
  id,
  name: "Jane Smith",
  email: "jane.smith@example.com",
  supporterId: null,
  status: "approved",
  registeredAt: new Date("2026-10-20T09:00:00.000Z"),
  changedAt: new Date("2026-10-20T09:00:00.000Z"),
  postcode: null,
  phone: null,
  cameFrom: null,
  ...more,
});

export const exampleGuests: Guest[] = [
  guest("gst-jane", { supporterId: 12, postcode: "SW1A 1AA", phone: "+447700900123", cameFrom: "newsletter" }),
  guest("gst-john", { name: "John Smith", email: "john.smith@example.com", postcode: "M1 1AE" }),
  guest("gst-no-name", {
    name: "",
    email: "no.name@example.com",
    status: "pending_approval",
    registeredAt: new Date("2026-10-30T18:00:00.000Z"),
    changedAt: new Date("2026-10-30T18:00:00.000Z"),
  }),
  guest("gst-ann", {
    name: "Ann Lee",
    email: "ann.lee@example.com",
    supporterId: 14,
    status: "waitlist",
    registeredAt: new Date("2026-10-25T12:00:00.000Z"),
    changedAt: new Date("2026-10-28T12:00:00.000Z"),
  }),
  guest("gst-sam", { name: "Sam Jones", email: "sam.jones@example.com", status: "declined", cameFrom: "brixton" }),
];

/** Guests who answered no questions and came by no tagged link: no postcode, phone or Came from. */
export const exampleGuestsAnsweringNothing: Guest[] = exampleGuests.map((one) => ({
  ...one,
  postcode: null,
  phone: null,
  cameFrom: null,
}));
