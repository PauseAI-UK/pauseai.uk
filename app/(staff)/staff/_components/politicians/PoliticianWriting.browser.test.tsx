import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import type { EmailSource } from "@/lib/politicians/aliases.server";
import { staffDate } from "@/lib/staff-time";
import { exampleAliases, examplePolitician } from "./PoliticianTable.examples";
import { AddressesBubble } from "./PoliticianWriting";
import { AddressesBubbleExample, SalutationBubbleExample } from "./PoliticianWriting.gallery.client";
import { politiciansCopy } from "./copy";

describe("PoliticianWriting's examples in the gallery", () => {
  // Their Server Actions are logged, not sent: pressing each adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("sets a Lord's email in its bubble, with why, saying why it's theirs to set, and what the server answered", async () => {
    await render(<AddressesBubbleExample lord result={{ saved: false, why: "shared" }} />);
    const words = politiciansCopy.politician.editDetails;
    await expect.element(page.getByText(words.emailHint)).toBeVisible();
    // With no email, no other addresses to list, nor a way to add one.
    await expect.element(page.getByText(politiciansCopy.politician.aliases.title)).not.toBeInTheDocument();
    await page.getByRole("textbox", { name: words.email }).fill("contactholmember@parliament.uk");
    await page.getByRole("textbox", { name: words.note }).fill("Found it");
    await page.getByRole("button", { name: words.save }).click();
    await expect.element(page.getByRole("status").first()).toHaveTextContent(words.refused.shared);
    await expect
      .element(log().nth(0))
      .toHaveTextContent(
        'editDetails({"politicianId":"7","salutation":"Lord Seedling","email":"contactholmember@parliament.uk","note":"Found it"})',
      );
  });

  it("changes an MP's email in its bubble, which won't send without why, and lists their other addresses, with Remove and Add", async () => {
    await render(<AddressesBubbleExample result={{ saved: true }} />);
    const words = politiciansCopy.politician.aliases;
    const edit = politiciansCopy.politician.editDetails;
    await expect.element(page.getByRole("button", { name: words.more(7) })).toBeVisible();
    expect(document.querySelector("[popover]:popover-open")!.textContent).toContain("@pollyplaceholder.org.uk");
    // The hint is a Lord's: an MP's body lists their email.
    await expect.element(page.getByText(edit.emailHint)).not.toBeInTheDocument();
    await page.getByRole("textbox", { name: edit.email }).fill("polly@example.org");
    await page.getByRole("button", { name: edit.save }).click();
    // The note is required, so the form isn't sent without it.
    expect(log().elements()).toHaveLength(0);
    await page.getByRole("textbox", { name: edit.note }).fill("Her office asked");
    await page.getByRole("button", { name: edit.save }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent(
        'editDetails({"politicianId":"7","salutation":"Ms Placeholder","email":"polly@example.org","note":"Her office asked"})',
      );
    // Saved, the bubble closes; it opens again from its button.
    await expect.element(page.getByRole("textbox", { name: edit.email })).not.toBeInTheDocument();
    await page.getByRole("button", { name: words.more(7) }).click();
    await page.getByRole("button", { name: words.remove }).first().click();
    await expect
      .element(log().nth(1))
      .toHaveTextContent('removeAlias({"politicianId":"7","address":"jane.smith@parliament.uk"})');
    await expect.element(page.getByRole("button", { name: words.add })).toBeVisible();
  });

  it("says under their main address where it came from: the staff edit with its note, their body's list, or nothing", async () => {
    const edit = politiciansCopy.politician.editDetails;
    const words = politiciansCopy.politician.aliases;
    const bubble = (emailSource: EmailSource, setEmail?: () => undefined) => (
      <AddressesBubble
        politician={examplePolitician}
        aliases={{ ...exampleAliases, emailSource }}
        actions={{ add: vi.fn(), remove: vi.fn() }}
        setEmail={setEmail}
        open
      />
    );
    const part = () => document.querySelector("[popover] h3")!.parentElement!.textContent;
    const at = new Date("2026-11-03T10:00:00Z");
    const { rerender } = await render(bubble({ by: "staff", staff: "jo@pauseai.uk", at, note: "Asked" }, vi.fn()));
    expect(part()).toContain(edit.mainIntro);
    expect(part()).toContain(edit.setBy("jo@pauseai.uk", staffDate(at), "Asked"));
    // An edit from before notes: who and when alone.
    await rerender(bubble({ by: "staff", staff: "jo@pauseai.uk", at, note: "" }, vi.fn()));
    expect(part()).toContain(edit.setBy("jo@pauseai.uk", staffDate(at), ""));
    // Without a way to change it, the address alone, and where it came from.
    await rerender(bubble({ by: "body" }));
    await expect.element(page.getByRole("textbox", { name: edit.email })).not.toBeInTheDocument();
    expect(part()).toContain(examplePolitician.email);
    expect(part()).toContain(words.sources.parliament);
    await rerender(bubble(null));
    expect(part()).toBe(`${edit.mainEmail}${edit.mainIntro}${examplePolitician.email}`);
  });

  it("changes a salutation in its bubble, closing it once saved, and offers Ms or Mr for one made from the name", async () => {
    const words = politiciansCopy.politician.editDetails;
    const { rerender } = await render(<SalutationBubbleExample result={{ saved: true }} />);
    await page.getByRole("button", { name: words.edit }).click();
    const field = page.getByRole("textbox", { name: words.salutation });
    await expect.element(field).toBeVisible();
    await page.getByRole("button", { name: words.save }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('editDetails({"politicianId":"7","salutation":"Ms Placeholder"})');
    await expect.element(field).not.toBeInTheDocument();
    await rerender(<SalutationBubbleExample fromName result={{ saved: false, why: "salutation" }} />);
    await page.getByRole("button", { name: words.edit }).click();
    await expect.element(page.getByText(words.fromName)).toBeVisible();
    await page.getByRole("button", { name: "Mr Placeholder" }).click();
    await expect
      .element(log().nth(1))
      .toHaveTextContent('editDetails({"politicianId":"7","salutation":"Mr Placeholder"})');
    // Refused, the bubble stays open.
    await expect.element(page.getByRole("button", { name: "Ms Placeholder" })).toBeVisible();
  });
});
