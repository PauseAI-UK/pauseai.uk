import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused } from "@/lib/form-result";
import type { EmailSource } from "@/lib/politicians/aliases.server";
import { staffDate } from "@/lib/staff-time";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { RefusalPlace } from "../ui/ResultForm";
import { exampleAliases, examplePolitician } from "./PoliticianTable.examples";
import { AddressesBubble, type EditAction } from "./PoliticianWriting";
import { AddressesBubbleExample, SalutationBubbleExample } from "./PoliticianWriting.gallery.client";
import { politiciansCopy } from "./copy";

// The page's address, which the place a page says things at its top reads.
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/politicians/7",
  useSearchParams: () => new URLSearchParams(),
}));

describe("PoliticianWriting's examples in the gallery", () => {
  // Their Server Actions are logged, not sent: pressing each adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("sets a Lord's email in its bubble, with why, saying why it's theirs to set, and what the server answered", async () => {
    await render(<AddressesBubbleExample lord result={{ ok: false, reason: "shared" }} />);
    const words = politiciansCopy.politician.editDetails;
    await expect.element(page.getByText(words.emailHint)).toBeVisible();
    // With no email, no other addresses to list, nor a way to add one.
    await expect.element(page.getByText(politiciansCopy.politician.aliases.title)).not.toBeInTheDocument();
    await page.getByRole("textbox", { name: words.email }).fill("contactholmember@parliament.uk");
    await page.getByRole("textbox", { name: words.note }).fill("Found it");
    await page.getByRole("button", { name: words.save }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(words.refused.shared);
    // Refused for the address, which is marked, with what was typed still in both fields.
    await expect.element(page.getByRole("textbox", { name: words.email })).toHaveAttribute("aria-invalid", "true");
    await expect
      .element(page.getByRole("textbox", { name: words.email }))
      .toHaveValue("contactholmember@parliament.uk");
    await expect.element(page.getByRole("textbox", { name: words.note })).toHaveValue("Found it");
    await expect.element(page.getByRole("textbox", { name: words.note })).not.toHaveAttribute("aria-invalid");
    await expect
      .element(log().nth(0))
      .toHaveTextContent(
        'editDetails({"politicianId":"7","salutation":"Lord Seedling","email":"contactholmember@parliament.uk","note":"Found it"})',
      );
  });

  it("changes an MP's email in its bubble, which won't send without why, and lists their other addresses, with Remove and Add", async () => {
    await render(<AddressesBubbleExample result={{ ok: true }} />);
    const words = politiciansCopy.politician.aliases;
    const edit = politiciansCopy.politician.editDetails;
    await expect.element(page.getByRole("button", { name: words.more(7) })).toBeVisible();
    expect(document.querySelector("[popover]:popover-open")!.textContent).toContain("@pollyplaceholder.org.uk");
    // The hint is a Lord's: an MP's body lists their email.
    await expect.element(page.getByText(edit.emailHint)).not.toBeInTheDocument();
    // Their email, with its edit, which opens the field.
    await expect.element(page.getByRole("textbox", { name: edit.email })).not.toBeInTheDocument();
    const editButton = page.getByRole("button", { name: politiciansCopy.politician.edit, exact: true });
    await editButton.click();
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
    // Saved, the bubble stays open, the field folded, showing the address and its Edit.
    await expect.element(page.getByRole("textbox", { name: edit.email })).not.toBeInTheDocument();
    await expect.element(editButton).toBeVisible();
    // Closed with the field open, it opens again with it folded.
    await editButton.click();
    await page.getByRole("button", { name: words.more(7) }).click();
    await page.getByRole("button", { name: words.more(7) }).click();
    await expect.element(editButton).toBeVisible();
    await page.getByRole("button", { name: words.remove }).first().click();
    await expect
      .element(log().nth(1))
      .toHaveTextContent('removeAlias({"politicianId":"7","address":"jane.smith@parliament.uk"})');
    await expect.element(page.getByRole("button", { name: words.add })).toBeVisible();
  });

  it("with no linked address, opens from an edit, and has Add close under the intro", async () => {
    const none = { past: [], parliament: [], office: [], added: [], domains: [], forms: [] };
    await render(
      <AddressesBubble
        politician={examplePolitician}
        aliases={{ ...exampleAliases, ...none }}
        actions={{ add: vi.fn(), remove: vi.fn() }}
      />,
    );
    const words = politiciansCopy.politician.aliases;
    await page.getByRole("button", { name: politiciansCopy.politician.editDetails.edit, exact: true }).click();
    const intro = page.getByText(words.intro).element();
    const add = page.getByRole("button", { name: words.add });
    // Nothing between them but the empty list: Add sits a small gap under the intro.
    const gap = add.element().getBoundingClientRect().top - intro.getBoundingClientRect().bottom;
    expect(gap).toBeLessThan(16);
    await add.click();
    await expect.element(page.getByLabelText(words.address)).toBeVisible();
    const form = page.getByRole("form", { name: words.add }).element();
    expect(form.getBoundingClientRect().top - intro.getBoundingClientRect().bottom).toBeLessThan(16);
  });

  it("says under their main address where it came from: the staff edit with its note, their body's list, or nothing", async () => {
    const edit = politiciansCopy.politician.editDetails;
    const words = politiciansCopy.politician.aliases;
    const bubble = (emailSource: EmailSource, setEmail?: EditAction) => (
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
    expect(part()).toContain(`Asked · ${politiciansCopy.politician.setBy("jo@pauseai.uk", staffDate(at))}`);
    // An edit from before notes: who and when alone.
    await rerender(bubble({ by: "staff", staff: "jo@pauseai.uk", at, note: "" }, vi.fn()));
    expect(part()).toContain(
      `${examplePolitician.email}${politiciansCopy.politician.setBy("jo@pauseai.uk", staffDate(at))}`,
    );
    // Without a way to change it, the address alone, and where it came from.
    await rerender(bubble({ by: "body" }));
    await expect.element(page.getByRole("textbox", { name: edit.email })).not.toBeInTheDocument();
    expect(part()).toContain(examplePolitician.email);
    expect(part()).toContain(words.sources.parliament("commons"));
    // An MSP's names their own body.
    await rerender(
      <AddressesBubble
        politician={{ ...examplePolitician, house: "scottish-parliament" }}
        aliases={{ ...exampleAliases, emailSource: { by: "body" } }}
        actions={{ add: vi.fn(), remove: vi.fn() }}
        open
      />,
    );
    expect(part()).toContain(words.sources.parliament("scottish-parliament"));
    expect(words.sources.parliament("scottish-parliament")).toContain("the Scottish Parliament");
    expect(words.sources.parliament()).toBe(words.sources.parliament("lords"));
    await rerender(bubble({ by: "airtable" }));
    expect(part()).toContain(edit.fromAirtable);
    await rerender(bubble(null));
    expect(part()).toBe(`${edit.mainEmail}${edit.mainIntro}${examplePolitician.email}`);
  });

  it("changes a salutation in its bubble, with why, closing it once saved, and offers Ms or Mr for one made from the name", async () => {
    const words = politiciansCopy.politician.editDetails;
    const { rerender } = await render(<SalutationBubbleExample result={{ ok: true }} />);
    await page.getByRole("button", { name: words.edit }).click();
    const field = page.getByRole("textbox", { name: words.salutation });
    await expect.element(field).toBeVisible();
    await page.getByRole("textbox", { name: words.note }).fill("Her letters");
    await page.getByRole("button", { name: words.save }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('editDetails({"politicianId":"7","salutation":"Ms Placeholder","note":"Her letters"})');
    await expect.element(field).not.toBeInTheDocument();
    await rerender(<SalutationBubbleExample fromName result={{ ok: false, reason: "salutation" }} />);
    await page.getByRole("button", { name: words.edit }).click();
    await expect.element(page.getByText(words.fromName)).toBeVisible();
    // A choice puts itself in the field and leads on to why, sending nothing yet.
    await page.getByRole("button", { name: "Mr Placeholder" }).click();
    await expect.element(field).toHaveValue("Mr Placeholder");
    await expect.element(page.getByRole("textbox", { name: words.note })).toHaveFocus();
    expect(log().elements()).toHaveLength(1);
    await page.getByRole("textbox", { name: words.note }).fill("His website");
    await page.getByRole("button", { name: words.save }).click();
    await expect
      .element(log().nth(1))
      .toHaveTextContent('editDetails({"politicianId":"7","salutation":"Mr Placeholder","note":"His website"})');
    // Refused, the bubble stays open, saying why, the salutation marked.
    await expect.element(page.getByRole("button", { name: "Ms Placeholder" })).toBeVisible();
    await expect.element(page.getByRole("alert")).toHaveTextContent(words.refused.salutation);
    await expect.element(field).toHaveAttribute("aria-invalid", "true");
  });
});

describe("PoliticianWriting, when the server can't do what's asked", () => {
  const edit = politiciansCopy.politician.editDetails;
  const words = politiciansCopy.politician.aliases;

  it("says at the top of the page that the politician can't be edited any more, their email's field still open", async () => {
    await render(
      <RefusalPlace>
        <AddressesBubble
          politician={{ ...examplePolitician, email: null }}
          aliases={{ ...exampleAliases, email: null, emailSource: null }}
          actions={{ add: vi.fn(), remove: vi.fn() }}
          setEmail={async () => refused("gone")}
          open
        />
      </RefusalPlace>,
    );
    await page.getByRole("textbox", { name: edit.email }).fill("polly@example.org");
    await page.getByRole("textbox", { name: edit.note }).fill("Her office asked");
    await page.getByRole("button", { name: edit.save }).click();
    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent(edit.refused.gone);
    // Over the page, not in the bubble.
    expect(document.querySelector("[popover]")!.contains(alert.element())).toBe(false);
    await expect.element(page.getByRole("textbox", { name: edit.email })).toBeVisible();
  });

  it("says by an address's Remove when removing it fails", async () => {
    // As the server throws: an error with a digest, which the server has kept, so the browser tells no one.
    const remove = vi.fn().mockRejectedValue(Object.assign(new Error("The server threw"), { digest: "1" }));
    await render(
      <AddressesBubble
        politician={examplePolitician}
        aliases={exampleAliases}
        actions={{ add: vi.fn(), remove }}
        open
      />,
    );
    const form = page.getByRole("form", { name: `${words.remove}: jane.smith@parliament.uk` });
    await form.getByRole("button", { name: words.remove }).click();
    await expect.element(form.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
  });
});
