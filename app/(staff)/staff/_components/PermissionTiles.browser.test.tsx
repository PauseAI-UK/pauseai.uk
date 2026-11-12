import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { exampleBlockedPermissions, exampleMemberDetails, exampleSupporterDetails } from "./SupportersTable.examples";
import PermissionTiles from "./PermissionTiles";
import { REASONS } from "@/lib/contact-permissions";

describe("PermissionTiles", () => {
  const copy = staffCopy.supporters.detail.permissions;
  const rows = () => [...document.querySelectorAll("ul > li")];
  const head = (row: Element) => row.querySelector("[class*=head]")!.textContent;
  const answers = (row: Element) => [...row.querySelectorAll("[class*=answer]")];
  const lines = (row: Element) => answers(row).map((a) => a.querySelector("[class*=line]")!.textContent);
  const reasons = (row: Element) => [...row.querySelectorAll("[class*=reason]")].map((r) => r.textContent);

  it("is a row a topic: its name and ?, each way and address with its answer and why, and what the topic is", async () => {
    await render(<PermissionTiles permissions={exampleSupporterDetails.permissions} />);
    const [newsletter, events] = rows();
    expect(rows()).toHaveLength(2);
    // The newsletter first; events with her email and her number in it, email first, each its own answer.
    expect(head(newsletter)).toBe(`${copy.topics.newsletter}?`);
    expect(lines(newsletter)).toEqual([`jane@example.com${copy.answers.email.yes}`]);
    // A UK number without its country code.
    expect(lines(events)).toEqual([`jane@example.com${copy.answers.email.no}`, `07700 900001${copy.answers.text.no}`]);
    expect(answers(events).map((a) => (a as HTMLElement).dataset.send)).toEqual(["no", "no"]);
    // Why, where from and when, under each.
    expect(reasons(events)).toEqual([
      copy.reasons.unsubscribed("12 Oct 2026", copy.sources.luma),
      copy.reasons.unsubscribed("12 Oct 2026", copy.sources.luma),
    ]);
    expect(reasons(newsletter)).toEqual([copy.reasons.asked("15 Oct 2026", copy.sources["email-your-mp"])]);
    // Green we can, plain we can't: the colour on the answer alone.
    expect(newsletter.querySelector("[class*=green]")).not.toBeNull();
    expect(events.querySelector("[class*=green], [class*=amber], [class*=red]")).toBeNull();
    // An address we can contact a link; one we can't, words; each after its icon, named for a screen reader.
    expect(newsletter.querySelector("a[href='mailto:jane@example.com']")).not.toBeNull();
    expect(events.querySelectorAll("[class*=address] a")).toHaveLength(0);
    expect([...events.querySelectorAll("[class*=address] svg")].map((svg) => svg.getAttribute("aria-label"))).toEqual([
      copy.email,
      copy.phone,
    ]);
    // The ? just after the topic's name opens what it is, and when it's a yes and a no.
    expect(newsletter.querySelector("[class*=head]")!.children[1].tagName).toBe("BUTTON");
    await page.getByRole("button", { name: copy.why }).nth(1).click();
    const popover = events.querySelector("[popover]")!;
    expect(popover.querySelector("strong")!.textContent).toBe(copy.topicTitle(copy.topics.events));
    expect([...popover.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual([copy.when.yes, copy.when.no]);
    await expect.element(page.getByText(copy.details.events.about)).toBeVisible();
  });

  it("names where each answer came from, or the newest form for a source it has no name for", async () => {
    const at = new Date("2026-10-16T12:00:00Z");
    const forms = (source: string | null, reason: "asked" | "declined" = "asked") => ({
      topic: "newsletter" as const,
      way: "email" as const,
      channel: "email" as const,
      address: `${source}@example.org`,
      send: reason === "asked" ? ("yes" as const) : ("no" as const),
      reason,
      at,
      source,
    });
    await render(
      <PermissionTiles
        permissions={[
          forms("march-2026-11"),
          forms("email-your-mp", "declined"),
          forms("web-form"),
          forms("a-new-form"),
          forms(null),
        ]}
      />,
    );
    expect(rows()).toHaveLength(1);
    expect(reasons(rows()[0])).toEqual([
      copy.reasons.asked("16 Oct 2026", copy.sources["march-2026-11"]),
      copy.reasons.declined("16 Oct 2026", copy.sources["email-your-mp"]),
      // pauseai.info's box, whose words we don't have.
      copy.reasons.asked("16 Oct 2026", copy.sources["web-form"]),
      copy.reasons.asked("16 Oct 2026", copy.otherSource),
      copy.reasons.asked("16 Oct 2026", copy.otherSource),
    ]);
  });

  it("puts a member's CiviCRM answers beside the rest, and a volunteer's number by text and by call", async () => {
    await render(<PermissionTiles permissions={exampleMemberDetails.permissions} />);
    const [newsletter, events, volunteering] = rows();
    expect(lines(newsletter)).toEqual([`rhea@example.com${copy.answers.email.yes}`]);
    expect(reasons(newsletter)).toEqual([copy.reasons.subscribed("10 Nov 2026", copy.sources.civicrm, "newsletter")]);
    expect(reasons(events)).toEqual([copy.reasons["not-following"]("", copy.sources.luma)]);
    // Her number's text and call answers are the same, so they share a line, a lozenge each, after a handset,
    // and the link rings it.
    expect(lines(volunteering)).toEqual([
      `rhea@example.com${copy.answers.email.no}`,
      `07700 900002${copy.answers.text.yes}${copy.answers.call.yes}`,
    ]);
    expect(volunteering.querySelector("a[href='tel:+447700900002']")).not.toBeNull();
    expect(reasons(volunteering)[0]).toBe(copy.reasons["no-bulk-email"]("10 Nov 2026", copy.sources.civicrm));
  });

  it("gives a number's text and call answers a line each when they differ, a text's link to WhatsApp", async () => {
    const [, , , text, call] = exampleMemberDetails.permissions;
    await render(
      <PermissionTiles
        permissions={[
          text,
          { ...call, send: "no", reason: "do-not-phone" },
          { ...text, address: "+447700900003", send: "no", reason: "do-not-sms" },
        ]}
      />,
    );
    const [volunteering] = rows();
    expect(lines(volunteering)).toEqual([
      `07700 900002${copy.answers.text.yes}`,
      `07700 900003${copy.answers.text.no}`,
      `07700 900002${copy.answers.call.no}`,
    ]);
    expect(volunteering.querySelector("a[href='https://wa.me/447700900002']")).not.toBeNull();
    expect(volunteering.querySelectorAll("a")).toHaveLength(1);
  });

  it("says a member who's gone is gone from Airtable, and any other source by its name", async () => {
    const [newsletter] = exampleMemberDetails.permissions;
    await render(
      <PermissionTiles
        permissions={[
          { ...newsletter, send: "no", reason: "left", source: "airtable" },
          { ...newsletter, address: "b@example.com", send: "no", reason: "left", source: "civicrm" },
        ]}
      />,
    );
    expect(reasons(rows()[0])).toEqual([
      copy.reasons.left("10 Nov 2026", copy.membersFrom),
      copy.reasons.left("10 Nov 2026", copy.sources.civicrm),
    ]);
  });

  it("says no for a blocked address under each of its topics, with what blocked it and the link to the blocked emails", async () => {
    await render(<PermissionTiles permissions={exampleBlockedPermissions} />);
    expect(rows().map(head)).toEqual([`${copy.topics.newsletter}?`, `${copy.topics.events}?`]);
    for (const row of rows()) {
      expect(lines(row)).toEqual([`gus@example.com${copy.answers.email.no}`]);
      expect(reasons(row)).toEqual([`${copy.blockedBecause.complaint("5 Oct 2026")} · ${copy.seeBlocked}`]);
      expect(row.querySelector("[class*=green], [class*=amber], [class*=red]")).toBeNull();
      expect(row.querySelectorAll("[class*=address] a")).toHaveLength(0);
    }
    await expect
      .element(page.getByRole("link", { name: copy.seeBlocked }).first())
      .toHaveAttribute("href", "/staff/supporters/bounced-emails");
  });

  it("words every reason it can give, with when", async () => {
    const [, luma] = exampleSupporterDetails.permissions;
    const permissions = REASONS.filter((reason) => reason !== "blocked").map((reason) => ({
      ...luma,
      address: `${reason}@example.com`,
      reason,
      at: new Date("2026-09-12T10:00:00Z"),
      source: "civicrm",
    }));
    await render(<PermissionTiles permissions={permissions} />);
    for (const reason of REASONS)
      expect(document.body.textContent, reason).toContain(copy.reasons[reason]("12 Sept 2026", copy.sources.civicrm));
  });

  it("names the CiviCRM list a yes is from: the volunteer list for volunteering, else the newsletter", async () => {
    const [newsletter] = exampleMemberDetails.permissions;
    await render(<PermissionTiles permissions={[newsletter, { ...newsletter, topic: "volunteering" }]} />);
    expect(rows().map((row) => reasons(row)[0])).toEqual([
      copy.reasons.subscribed("10 Nov 2026", copy.sources.civicrm, "newsletter"),
      copy.reasons.subscribed("10 Nov 2026", copy.sources.civicrm, "volunteering"),
    ]);
    expect(reasons(rows()[0])[0]).not.toBe(reasons(rows()[1])[0]);
  });

  it("says what blocked an address: a bounce, a hold, or only the link for a block it has no words for", async () => {
    const [blocked] = exampleBlockedPermissions;
    const { rerender } = await render(<PermissionTiles permissions={[{ ...blocked, source: "hard" }]} />);
    expect(reasons(rows()[0])).toEqual([`${copy.blockedBecause.hard("5 Oct 2026")} · ${copy.seeBlocked}`]);
    await rerender(<PermissionTiles permissions={[{ ...blocked, source: "hold" }]} />);
    expect(reasons(rows()[0])).toEqual([`${copy.blockedBecause.hold("5 Oct 2026")} · ${copy.seeBlocked}`]);
    await rerender(<PermissionTiles permissions={[{ ...blocked, source: null }]} />);
    expect(reasons(rows()[0])).toEqual([copy.seeBlocked]);
  });

  it("words a yes it can't date, or from a source it has no name for", async () => {
    const [jane] = exampleSupporterDetails.permissions;
    await render(
      <PermissionTiles
        permissions={[
          { ...jane, at: null },
          { ...jane, address: "b@example.com", source: null },
          { ...jane, address: "c@example.com", reason: "signed-up", source: "paper-signup" },
        ]}
      />,
    );
    expect(reasons(rows()[0])).toEqual([
      copy.reasons.asked("", copy.sources["email-your-mp"]),
      copy.reasons.asked("15 Oct 2026", copy.otherSource),
      copy.reasons["signed-up"]("15 Oct 2026", copy.sources["paper-signup"]),
    ]);
  });
});
