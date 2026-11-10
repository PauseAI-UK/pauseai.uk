import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { exampleBlockedPermissions, exampleMemberDetails, exampleSupporterDetails } from "./SupportersTable.examples";
import PermissionTiles from "./PermissionTiles";
import { type Reason, type Topic } from "@/lib/contact-permissions";

describe("PermissionTiles", () => {
  const copy = staffCopy.supporters.detail.permissions;
  const rows = () => [...document.querySelectorAll("ul > li")];
  const head = (row: Element) => row.querySelector("[class*=head]")!.textContent;
  const answers = (row: Element) => [...row.querySelectorAll("[class*=answer]")];
  const lines = (row: Element) => answers(row).map((a) => a.querySelector("[class*=line]")!.textContent);
  const reasons = (row: Element) => [...row.querySelectorAll("[class*=reason]")].map((r) => r.textContent);

  it("is a row a topic: its name and ?, each address or number with its answer, then why, and how we know", async () => {
    await render(<PermissionTiles permissions={exampleSupporterDetails.permissions} />);
    const [forms, luma] = rows();
    expect(rows()).toHaveLength(2);
    // Ours first; Luma's with her email and her number in it, email first, each its own answer in its words.
    expect(head(forms)).toBe(`${copy.topics.email["site-forms"]}?`);
    expect(lines(forms)).toEqual([`jane@example.com${copy.answers.email.yes}`]);
    expect(lines(luma)).toEqual([`jane@example.com${copy.answers.email.no}`, `+447700900001${copy.answers.text.no}`]);
    expect(answers(luma).map((a) => (a as HTMLElement).dataset.send)).toEqual(["no", "no"]);
    // The reason they share, once.
    expect(reasons(luma)).toEqual([copy.reasons["luma-calendar"].unsubscribed("12 Oct 2026")]);
    // Green we can, plain we can't: the colour on the answer alone.
    expect(forms.querySelector("[class*=green]")).not.toBeNull();
    expect(luma.querySelector("[class*=green], [class*=amber], [class*=red]")).toBeNull();
    // An address we can contact a link; one we can't, words; each after its icon, named for a screen reader.
    expect(forms.querySelector("a[href='mailto:jane@example.com']")).not.toBeNull();
    expect(luma.querySelectorAll("[class*=address] a")).toHaveLength(0);
    expect([...luma.querySelectorAll("[class*=address] svg")].map((svg) => svg.getAttribute("aria-label"))).toEqual([
      copy.email,
      copy.phone,
    ]);
    // The ? just after the topic's name.
    expect(forms.querySelector("[class*=head]")!.children[1].tagName).toBe("BUTTON");
    // How we know: the topic by name, then each channel's part, named with its icon, labelled in its words.
    await page.getByRole("button", { name: copy.why }).nth(1).click();
    const popover = luma.querySelector("[popover]")!;
    expect(popover.querySelector("strong")!.textContent).toBe(copy.topicTitle(copy.topics.email["luma-calendar"]));
    expect([...popover.querySelectorAll("[class*=channelName]")].map((p) => p.textContent)).toEqual([
      staffCopy.supporters.filters.channels.email,
      staffCopy.supporters.filters.channels.phone,
    ]);
    expect([...popover.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual([
      copy.when.email.yes,
      copy.when.email.no,
      copy.caveat,
      copy.when.text.yes,
      copy.when.text.no,
    ]);
    await expect.element(page.getByText(copy.details.phone["luma-calendar"].about)).toBeVisible();
    // One channel's is named too.
    expect([...forms.querySelectorAll("[popover] [class*=channelName]")].map((p) => p.textContent)).toEqual([
      staffCopy.supporters.filters.channels.email,
    ]);
  });

  it("names the form whose box answered for our forms, or the newest form for one it has no name for", async () => {
    const at = new Date("2026-10-16T12:00:00Z");
    const forms = (source: string | null, reason: "asked" | "declined" = "asked") => ({
      topic: "site-forms" as const,
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
    // One row, each address with its own reason, as they differ.
    expect(rows()).toHaveLength(1);
    expect(reasons(rows()[0])).toEqual([
      copy.reasons["site-forms"].asked("16 Oct 2026", copy.forms["march-2026-11"]),
      copy.reasons["site-forms"].declined("16 Oct 2026", copy.forms["email-your-mp"]),
      copy.reasons["site-forms"].asked("16 Oct 2026", copy.forms["web-form"]),
      copy.reasons["site-forms"].asked("16 Oct 2026", copy.otherForm),
      copy.reasons["site-forms"].asked("16 Oct 2026", copy.otherForm),
    ]);
  });

  it("says not sure where an unsubscribe may not have reached us", async () => {
    await render(<PermissionTiles permissions={exampleMemberDetails.permissions} />);
    const [luma, updates, volunteering] = rows();
    expect(head(luma)).toContain(copy.topics.email["luma-calendar"]);
    expect(lines(updates)).toEqual([`rhea@example.com${copy.answers.email.unsure}`]);
    expect(updates.querySelector("[class*=amber]")).not.toBeNull();
    // A volunteer's number, a yes; an unsure one not sure, as by email.
    expect(lines(volunteering)).toEqual([`+447700900002${copy.answers["call-or-text"].yes}`]);
    const [, , phone] = exampleMemberDetails.permissions;
    await render(<PermissionTiles permissions={[{ ...phone, send: "unsure", reason: "gave-number" }]} />);
    expect(lines(rows().at(-1)!)).toEqual([`+447700900002${copy.answers["call-or-text"].unsure}`]);
  });

  it("names each address, and falls back to the reason's own name", async () => {
    const [luma] = exampleSupporterDetails.permissions;
    await render(
      <PermissionTiles
        permissions={[
          { ...luma, reason: "joined", at: null },
          { ...luma, address: "other@example.com" },
        ]}
      />,
    );
    expect(lines(rows()[0])).toEqual([
      `jane@example.com${copy.answers.email.no}`,
      `other@example.com${copy.answers.email.no}`,
    ]);
    expect(reasons(rows()[0])[0]).toBe("joined");
  });

  it("says no for a blocked address under each of its topics, with what blocked it and the link to the blocked emails", async () => {
    await render(<PermissionTiles permissions={exampleBlockedPermissions} />);
    expect(rows().map(head)).toEqual([`${copy.topics.email["site-forms"]}?`, `${copy.topics.email["luma-calendar"]}?`]);
    for (const row of rows()) {
      expect(lines(row)).toEqual([`gus@example.com${copy.answers.email.no}`]);
      expect(reasons(row)).toEqual([`${copy.blockedBecause.complaint("5 Oct 2026")} ${copy.seeBlocked}`]);
      expect(row.querySelector("[class*=green], [class*=amber], [class*=red]")).toBeNull();
      expect(row.querySelectorAll("[class*=address] a")).toHaveLength(0);
    }
    await expect
      .element(page.getByRole("link", { name: copy.seeBlocked }).first())
      .toHaveAttribute("href", "/staff/supporters/blocked-emails");
  });

  it("words every reason it can give, with when", async () => {
    const [luma] = exampleSupporterDetails.permissions;
    const permissions = Object.entries(copy.reasons).flatMap(([topic, reasons]) =>
      Object.keys(reasons).map((reason, i) => ({
        ...luma,
        // A topic only phones have is a number's; each reason its own address, so each says its own.
        channel: topic === "volunteering" || topic === "march-day" ? ("phone" as const) : ("email" as const),
        address: `${reason}-${i}@example.com`,
        topic: topic as Topic,
        reason: reason as Reason,
        at: new Date("2026-09-12T10:00:00Z"),
      })),
    );
    await render(<PermissionTiles permissions={permissions} />);
    for (const [topic, reasons] of Object.entries(copy.reasons))
      for (const words of Object.values(reasons))
        // The example's source is Luma's, a form it has no name for.
        expect(document.body.textContent, topic).toContain(words("12 Sept 2026", copy.otherForm));
  });

  it("says a bounce blocked an address, and only the link for a block it can't date", async () => {
    const [blocked] = exampleBlockedPermissions;
    const { rerender } = await render(<PermissionTiles permissions={[{ ...blocked, source: "hard" }]} />);
    expect(reasons(rows()[0])).toEqual([`${copy.blockedBecause.hard("5 Oct 2026")} ${copy.seeBlocked}`]);
    await rerender(<PermissionTiles permissions={[{ ...blocked, source: null }]} />);
    expect(reasons(rows()[0])).toEqual([copy.seeBlocked]);
  });

  it("keeps a blocked address beside another of its topic, each with its own answer and reason", async () => {
    const [blocked] = exampleBlockedPermissions;
    const agreed = exampleSupporterDetails.permissions.find((p) => p.topic === "site-forms")!;
    // A cause it has no words for: the link alone.
    await render(<PermissionTiles permissions={[{ ...blocked, topic: "site-forms", source: "soft" }, agreed]} />);
    expect(rows()).toHaveLength(1);
    expect(lines(rows()[0])).toEqual([
      `gus@example.com${copy.answers.email.no}`,
      `jane@example.com${copy.answers.email.yes}`,
    ]);
    expect(reasons(rows()[0])).toHaveLength(2);
    expect(reasons(rows()[0])[0]).toBe(copy.seeBlocked);
    expect(rows()[0].querySelectorAll("a[href='/staff/supporters/blocked-emails']")).toHaveLength(1);
  });
});
