import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { exampleBlockedPermissions, exampleMemberDetails, exampleSupporterDetails } from "./SupportersTable.examples";
import PermissionTiles, { ListHelp } from "./PermissionTiles";
import { REASONS } from "@/lib/supporters/contact-permissions";
import { supportersCopy } from "./copy";

describe("PermissionTiles", () => {
  const copy = supportersCopy.supporters.detail.permissions;
  const lists = supportersCopy.supporters.filters.lists;
  // The lists' rows, not the lines in a "?" bubble's list.
  const rows = () => [...document.querySelectorAll("ul[class*=list] > li")];
  const head = (row: Element) => row.querySelector("[class*=head]")!.textContent;
  const answers = (row: Element) => [...row.querySelectorAll("[class*=answer]")];
  const lines = (row: Element) => answers(row).map((a) => a.querySelector("[class*=line]")!.textContent);
  const reasons = (row: Element) => [...row.querySelectorAll("[class*=reason]")].map((r) => r.textContent);

  it("is a row a list: its name and ?, each way and address with its answer and why, and what the list is", async () => {
    await render(<PermissionTiles permissions={exampleSupporterDetails.permissions} />);
    const [updates, lumaOnly] = rows();
    // She has answers through Luma but isn't on the calendar, so no row of Luma's own messages.
    expect(rows()).toHaveLength(2);
    // Updates first, with her email. Then what Luma alone reached: her Luma number, which Updates has no answer
    // for, with its no. Not her email's no to events, as Updates' row has her email.
    expect(head(updates)).toBe(`${lists.updates}?`);
    expect(lines(updates)).toEqual([`jane@example.com${copy.answers.email.yes}`]);
    expect(head(lumaOnly)).toBe(`${copy.lumaOnly.name}?`);
    // A UK number without its country code.
    expect(lines(lumaOnly)).toEqual([`07700 900001${copy.answers.text.no}`]);
    expect(answers(lumaOnly).map((a) => (a as HTMLElement).dataset.send)).toEqual(["no"]);
    // Why, where from and when, under each.
    expect(reasons(lumaOnly)).toEqual([copy.reasons.unsubscribed("12 Oct 2026", copy.sources.luma)]);
    expect(reasons(updates)).toEqual([copy.reasons.asked("15 Oct 2026", copy.sources["email-your-mp"])]);
    // Green we can, plain we can't: the colour on the answer alone.
    expect(updates.querySelector("[class*=green]")).not.toBeNull();
    expect(lumaOnly.querySelector("[class*=green]")).toBeNull();
    // An address we can contact a link; one we can't, words; each after its icon, named for a screen reader.
    expect(updates.querySelector("a[href='mailto:jane@example.com']")).not.toBeNull();
    expect(lumaOnly.querySelectorAll("[class*=address] a")).toHaveLength(0);
    expect(
      [updates, lumaOnly].map((row) => row.querySelector("[class*=address] svg")!.getAttribute("aria-label")),
    ).toEqual([copy.email, copy.phone]);
    // The ? just after the list's name opens what it is: for Luma alone, who that is, with no list of sources.
    expect(updates.querySelector("[class*=head]")!.children[1].tagName).toBe("BUTTON");
    await page.getByRole("button", { name: copy.why }).nth(1).click();
    const popover = lumaOnly.querySelector("[popover]")!;
    expect(popover.querySelector("strong")!.textContent).toBe(copy.topicTitle(copy.lumaOnly.name));
    expect(popover.querySelectorAll("li")).toHaveLength(0);
    await expect.element(page.getByText(copy.lumaOnly.about)).toBeVisible();
    // Updates' own says what puts someone on it.
    await page.getByRole("button", { name: copy.why }).first().click();
    expect([...updates.querySelectorAll("[popover] li")].map((li) => li.textContent)).toEqual(copy.details.updates.on);
  });

  it("gives Luma's own messages a row as a list's, and shows events' yes as Luma alone where Updates says no", async () => {
    const [newsletter] = exampleSupporterDetails.permissions;
    const no = { ...newsletter, send: "no" as const, reason: "declined" as const };
    const following = { ...newsletter, topic: "events" as const, reason: "following" as const, source: "luma" };
    const { rerender } = await render(<PermissionTiles permissions={[no, following]} luma={[following]} />);
    const [updates, lumaOnly, luma] = rows();
    expect(lines(updates)).toEqual([`jane@example.com${copy.answers.email.no}`]);
    expect(lines(lumaOnly)).toEqual([`jane@example.com${copy.answers.email.yes}`]);
    // Its name and ?, then the address on our Luma calendar, green, and since when. Not a link: Luma writes to it.
    expect(head(luma)).toBe(`${copy.luma.name}?`);
    expect(lines(luma)).toEqual([`jane@example.com${copy.luma.on}`]);
    expect(reasons(luma)).toEqual([copy.reasons.following("15 Oct 2026", copy.sources.luma)]);
    expect(luma.querySelector("[class*=green]")).not.toBeNull();
    expect(luma.querySelectorAll("a")).toHaveLength(0);
    await page.getByRole("button", { name: copy.why }).last().click();
    expect(luma.querySelector("[popover] strong")!.textContent).toBe(copy.topicTitle(copy.luma.name));
    expect([...luma.querySelectorAll("[popover] p")].map((p) => p.textContent)).toEqual(copy.luma.about);
    // Where Updates says yes too, events' yes says no more, so it has no row.
    await rerender(<PermissionTiles permissions={[newsletter, following]} luma={[following]} />);
    expect(rows().map(head)).toEqual([`${lists.updates}?`, `${copy.luma.name}?`]);
    // Off the calendar, the row stays, plain, with what took the address off and when.
    const off = { ...following, send: "no" as const, reason: "unsubscribed" as const, source: "staff" };
    await rerender(<PermissionTiles permissions={[newsletter]} luma={[off]} />);
    const [, gone] = rows();
    expect(lines(gone)).toEqual([`jane@example.com${copy.luma.off}`]);
    expect(reasons(gone)).toEqual([copy.reasons.unsubscribed("15 Oct 2026", copy.sources.staff)]);
    expect(gone.querySelector("[class*=green]")).toBeNull();
  });

  it("shows what stopped Luma alone reaching them, but not that they never followed the calendar", async () => {
    const [newsletter] = exampleSupporterDetails.permissions;
    const events = { ...newsletter, topic: "events" as const, send: "no" as const };
    await render(
      <PermissionTiles
        permissions={[
          { ...events, reason: "unsubscribed", source: "staff" },
          { ...events, address: "b@example.com", reason: "not-following", source: "luma", at: null },
        ]}
      />,
    );
    expect(rows().map(head)).toEqual([`${copy.lumaOnly.name}?`]);
    expect(lines(rows()[0])).toEqual([`jane@example.com${copy.answers.email.no}`]);
    expect(reasons(rows()[0])).toEqual([copy.reasons.unsubscribed("15 Oct 2026", copy.sources.staff)]);
  });

  it("opens what one list means from its own ?, as beside each list in the Consent menu and a broadcast's", async () => {
    await render(<ListHelp list="updates-luma" />);
    await page.getByRole("button", { name: copy.listHelp(lists["updates-luma"]) }).click();
    expect(document.querySelector("[popover] strong")!.textContent).toBe(copy.topicTitle(lists["updates-luma"]));
    // Updates' bubble lists what puts someone on it.
    await render(<ListHelp list="updates" />);
    await page.getByRole("button", { name: copy.listHelp(lists.updates) }).click();
    expect([...document.querySelectorAll("[popover]:popover-open li")].map((li) => li.textContent)).toEqual(
      copy.details.updates.on,
    );
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
    // Newsletter answers alone: Updates' row, and none for Luma alone.
    expect(rows().map(head)).toEqual([`${lists.updates}?`]);
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
    const [updates, volunteering] = rows();
    expect(lines(updates)).toEqual([`rhea@example.com${copy.answers.email.yes}`]);
    expect(reasons(updates)).toEqual([copy.reasons.member("10 Nov 2026", copy.sources.civicrm)]);
    // She isn't on the Luma calendar, so there's no row for Luma alone.
    expect(rows().map(head)).toEqual([`${lists.updates}?`, `${lists.volunteering}?`]);
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

  it("says where an answer came from by its source's name, or as their newest form for a source it doesn't name", async () => {
    const [newsletter] = exampleMemberDetails.permissions;
    await render(
      <PermissionTiles
        permissions={[
          { ...newsletter, send: "no", reason: "left", source: "civicrm" },
          { ...newsletter, address: "b@example.com", send: "no", reason: "left", source: "somewhere" },
        ]}
      />,
    );
    expect(reasons(rows()[0])).toEqual([
      copy.reasons.left("10 Nov 2026", copy.sources.civicrm),
      copy.reasons.left("10 Nov 2026", copy.otherSource),
    ]);
  });

  it("says no for a blocked address on each of its lists, with what blocked it and the link to the blocked emails", async () => {
    await render(<PermissionTiles permissions={exampleBlockedPermissions} />);
    expect(rows().map(head)).toEqual([`${lists.updates}?`]);
    for (const row of rows()) {
      expect(lines(row)).toEqual([`gus@example.com${copy.answers.email.no}`]);
      expect(reasons(row)).toEqual([`${copy.blockedBecause.complaint("5 Oct 2026")} · ${copy.seeBlocked}`]);
      expect(row.querySelector("[class*=green], [class*=amber], [class*=red]")).toBeNull();
      expect(row.querySelectorAll("[class*=address] a")).toHaveLength(0);
    }
    await expect
      .element(page.getByRole("link", { name: copy.seeBlocked }).first())
      .toHaveAttribute("href", "/staff/supporters/blocked-addresses");
  });

  it("words every reason it can give, with when", async () => {
    const [newsletter] = exampleSupporterDetails.permissions;
    const permissions = REASONS.filter((reason) => reason !== "blocked").map((reason) => ({
      ...newsletter,
      address: `${reason}@example.com`,
      reason,
      at: new Date("2026-09-12T10:00:00Z"),
      source: "civicrm",
    }));
    await render(<PermissionTiles permissions={permissions} />);
    for (const reason of REASONS)
      expect(document.body.textContent, reason).toContain(copy.reasons[reason]("12 Sept 2026", copy.sources.civicrm));
  });

  it("says where a volunteer's yes came from: joining in CiviCRM, or choosing on the preferences page", async () => {
    const [newsletter] = exampleMemberDetails.permissions;
    await render(
      <PermissionTiles
        permissions={[
          { ...newsletter, reason: "volunteered" },
          { ...newsletter, topic: "volunteering", reason: "volunteered", source: "preferences" },
        ]}
      />,
    );
    // Updates, then Volunteering.
    expect(rows().map((row) => reasons(row)[0])).toEqual([
      copy.reasons.volunteered("10 Nov 2026", copy.sources.civicrm),
      copy.reasons.volunteered("10 Nov 2026", copy.sources.preferences),
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
