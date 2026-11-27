// Every word of staff events that only the staff pages show, with those the
// server and pure code use too (lib/events/copy.ts).
import { eventsCopy as wordsTheServerUses } from "@/lib/events/copy";

export const eventsCopy = {
  ...wordsTheServerUses,
  // An event's page (/staff/events/<id>): the event, its guests on Luma, and the button to email them. Its facts'
  // labels are the events list's columns.
  event: {
    // The fact that links to the event's page on luma.com, and the link's words.
    luma: "On Luma",
    lumaLink: "Open in Luma",
    // Each guest's status on Luma, in the table; and in the counts at the band's right, after how many.
    statuses: {
      approved: "Going",
      pending_approval: "Awaiting approval",
      waitlist: "Waitlisted",
      declined: "Declined",
    },
    counted: {
      approved: "going",
      pending_approval: "awaiting approval",
      waitlist: "waitlisted",
      declined: "declined",
    },
    // The card of guests, for staff who see supporters: its title, and what it says when Luma lists no one.
    guests: "Guests",
    noGuests: "No one has registered on Luma yet.",
    // The table's headings. Postcode and phone are the guest's answers to the event's questions on Luma, and Came from
    // is the utm_source of the link they came by; each shows only when a guest has one.
    columns: {
      name: "Name",
      status: "Luma status",
      registered: "Registered",
      changed: "Last changed",
      postcode: "Postcode",
      phone: "Phone",
      cameFrom: "Came from",
    },
  },
};
