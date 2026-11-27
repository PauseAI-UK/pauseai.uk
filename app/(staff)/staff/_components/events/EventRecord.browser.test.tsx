import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import EventRecord from "./EventRecord";
import { exampleCounts, exampleGuests, exampleGuestsAnsweringNothing } from "./EventRecord.examples";
import { exampleEvents, exampleEventsNow } from "./EventsTable.examples";
import { eventsCopy } from "./copy";

const copy = eventsCopy.events;
const words = eventsCopy.event;
const protest = exampleEvents.find((event) => event.id === "evt-protest")!;
const removed = exampleEvents.find((event) => event.id === "evt-social")!;

const headings = () => [...document.querySelectorAll("thead th")].map((th) => th.textContent);
const row = (name: string) => [...document.querySelectorAll("tbody tr")].find((tr) => tr.textContent!.includes(name))!;
const cells = (name: string) => [...row(name).querySelectorAll("td")].map((td) => td.textContent);

describe("EventRecord", () => {
  it("shows the event's facts, its hosts and its page on Luma, and how many have each status", async () => {
    await render(
      <EventRecord
        event={protest}
        guests={exampleGuests}
        counts={exampleCounts(exampleGuests)}
        now={exampleEventsNow}
        broadcast={null}
      />,
    );
    await expect.element(page.getByRole("heading", { level: 1, name: protest.name })).toBeVisible();
    await expect.element(page.getByText("London", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Big events, London")).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.doc })).toHaveAttribute("href", protest.doc!);
    await expect.element(page.getByRole("link", { name: "Jane Smith" }).first()).toBeVisible();
    await expect.element(page.getByRole("link", { name: words.lumaLink })).toHaveAttribute("href", protest.url);
    const counts = document.querySelector("[class*=counts]")!.textContent;
    expect(counts).toContain(`2 ${words.counted.approved}`);
    expect(counts).toContain(`1 ${words.counted.pending_approval}`);
    expect(counts).toContain(`1 ${words.counted.waitlist}`);
    expect(counts).toContain(`1 ${words.counted.declined}`);
    expect(document.body.textContent).not.toContain(copy.removed);
  });

  it("lists each guest with their status and dates, and the postcode, phone and Came from columns some have", async () => {
    await render(
      <EventRecord
        event={protest}
        guests={exampleGuests}
        counts={exampleCounts(exampleGuests)}
        now={exampleEventsNow}
        broadcast={<button>Email</button>}
      />,
    );
    await expect.element(page.getByRole("heading", { name: words.guests })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Email" })).toBeVisible();
    // Who they are, then how they stand, with the dates that date it.
    expect(headings()).toEqual([
      words.columns.name,
      words.columns.postcode,
      words.columns.phone,
      words.columns.cameFrom,
      words.columns.status,
      words.columns.registered,
      words.columns.changed,
    ]);
    expect(cells("Jane Smith")).toEqual([
      "Jane Smith",
      "SW1A 1AA",
      "07700 900123",
      "newsletter",
      words.statuses.approved,
      "20 Oct 2026",
      "20 Oct 2026",
    ]);
    // Linked to their supporter, or not yet.
    expect(row("Jane Smith").querySelector("a")!.getAttribute("href")).toBe("/staff/supporters/12");
    expect(row("John Smith").querySelector("a")).toBeNull();
    // No name on Luma: their email.
    expect(cells("no.name@example.com")[4]).toBe(words.statuses.pending_approval);
    expect(cells("Ann Lee")[6]).toBe("28 Oct 2026");
    expect(cells("Sam Jones")[3]).toBe("brixton");
  });

  it("leaves out the postcode, phone and Came from columns when no guest has one", async () => {
    await render(
      <EventRecord
        event={protest}
        guests={exampleGuestsAnsweringNothing}
        counts={exampleCounts(exampleGuestsAnsweringNothing)}
        now={exampleEventsNow}
        broadcast={null}
      />,
    );
    expect(headings()).toEqual([
      words.columns.name,
      words.columns.status,
      words.columns.registered,
      words.columns.changed,
    ]);
  });

  it("says when no one has registered, and tags an event taken off Luma", async () => {
    await render(
      <EventRecord event={removed} guests={[]} counts={exampleCounts([])} now={exampleEventsNow} broadcast={null} />,
    );
    await expect.element(page.getByText(words.noGuests)).toBeVisible();
    await expect.element(page.getByText(copy.removed)).toBeVisible();
    await expect.element(page.getByText(copy.online)).not.toBeInTheDocument();
    expect(document.querySelector("table")).toBeNull();
  });

  it("shows staff who don't see supporters no guests, counts or hosts", async () => {
    await render(
      <EventRecord
        event={{ ...protest, city: null, hosts: [] }}
        guests={null}
        counts={null}
        now={exampleEventsNow}
        broadcast={<button>Email</button>}
      />,
    );
    await expect.element(page.getByText(copy.online)).toBeVisible();
    await expect.element(page.getByRole("heading", { name: words.guests })).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Email" })).not.toBeInTheDocument();
    expect(document.querySelector("[class*=counts]")).toBeNull();
    expect(document.body.textContent).not.toContain(copy.columns.hosts);
  });
});
