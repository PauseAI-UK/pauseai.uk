import { describe, expect, it, onTestFinished, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { exampleLetter } from "@/app/(staff)/staff/_components/LettersTable.examples";
import {
  AddAliasFormExample,
  EditPoliticianFormExample,
  PoliticianMarksExample,
  ChangeTimeFormExample,
  ChoosingListExample,
  DueTimeFieldsExample,
  EventColumnsExample,
  EventsListExample,
  EventsTableExample,
  HeldImportExample,
  MailingWriterExample,
  NoteChangesExample,
  NoteEntryExample,
  OptOutFormExample,
  NotesCardExample,
  NotesExample,
  NoteTextExample,
  NoticeExample,
  PasteFormExample,
  PickBoxExample,
  PoliticianDetailsExample,
  PoliticianTableEmptyExample,
  PoliticianTableExample,
  SignupPlanViewExample,
  SignupUploadHelpExample,
  SignupUploadPreviewExample,
} from "./staff.client";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));

// The staff examples' Server Actions are logged, not sent: pressing each adds its line to the event log.
const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");
const subject = () => page.getByLabelText(new RegExp(`^${staffCopy.mailingPages.subject}`));

describe("the staff examples", () => {
  it("opens and closes every column name under what the file needs", async () => {
    await render(<SignupUploadHelpExample />);
    const help = staffCopy.signupUpload.help;
    await page.getByRole("button", { name: help.more }).click();
    await expect.element(page.getByText(help.fields.postcode.values)).toBeVisible();
    await page.getByRole("button", { name: help.less }).click();
    expect(page.getByText(help.fields.postcode.values).elements()).toEqual([]);
  });

  it("previews and imports an upload, going to what it did", async () => {
    await render(<SignupPlanViewExample />);
    await render(<SignupUploadPreviewExample />);
    const importNow = page.getByRole("button", { name: staffCopy.signupUpload.preview.importNow(3, 1) });
    await expect.element(importNow).toBeEnabled();
    await importNow.click();
    await expect.poll(() => push.mock.calls).toEqual([["/staff/supporters/import/previous/6"]]);
  });

  it("picks a mailing's hour and minutes, and logs Change the time's save", async () => {
    // The example's day, early, as the fixture clock has it, so no hour's too soon whenever this runs.
    vi.useFakeTimers({ now: new Date("2026-10-16T06:00:00Z"), toFake: ["Date"] });
    onTestFinished(() => void vi.useRealTimers());
    const { unmount } = await render(<DueTimeFieldsExample />);
    const hour = page.getByRole("combobox", { name: staffCopy.mailingPages.hour });
    const minutes = page.getByRole("combobox", { name: staffCopy.mailingPages.minutes });
    await expect.element(minutes).toBeDisabled();
    await hour.selectOptions("15");
    await expect.element(hour).toHaveValue("15");
    await minutes.selectOptions("48");
    await expect.element(minutes).toHaveValue("48");
    await unmount();
    await render(<ChangeTimeFormExample />);
    await page.getByRole("button", { name: staffCopy.mailingPages.saveTime }).click();
    await expect.element(page.getByText(/^rescheduleMailingNow\(\{"id":"5"/)).toBeVisible();
  });

  it("logs a new note, as each reader sees the notes", async () => {
    const { unmount } = await render(<NotesExample as="admin" />);
    await expect.element(page.getByRole("button", { name: staffCopy.notes.delete }).nth(1)).toBeVisible();
    await unmount();
    await render(<NotesExample as="empty" />);
    await page.getByRole("button", { name: staffCopy.notes.write }).click();
    await page.getByRole("textbox", { name: staffCopy.notes.note }).fill("Met them");
    await page.getByRole("button", { name: staffCopy.notes.add }).click();
    await expect.element(log().nth(0)).toHaveTextContent('add({"supporterId":"1","body":"Met them"})');
  });

  it("shows a note's text with its links", async () => {
    const { unmount } = await render(<NotesExample />);
    await expect.element(page.getByRole("button", { name: staffCopy.notes.edit })).toBeVisible();
    await unmount();
    await render(<NoteTextExample />);
    await expect.element(page.getByRole("link", { name: "www.example.com/rota" })).toBeVisible();
  });

  it("logs a note drafted at the top of the card, and has no Write a note without its action", async () => {
    const { unmount } = await render(<NotesCardExample lines={false} />);
    await expect.element(page.getByText(staffCopy.notes.none)).toBeVisible();
    await page.getByRole("button", { name: staffCopy.notes.write }).click();
    await page.getByRole("textbox", { name: staffCopy.notes.note }).fill("Met them");
    await page.getByRole("button", { name: staffCopy.notes.add }).click();
    await expect.element(log().nth(0)).toHaveTextContent('add({"politicianId":"7","body":"Met them"})');
    await unmount();
    const plain = await render(<NotesCardExample writable={false} />);
    await expect.element(page.getByRole("button", { name: staffCopy.notes.write })).not.toBeInTheDocument();
    await plain.unmount();
    await render(<NotesCardExample />);
    await expect.element(page.getByText("Met them at the fair")).toBeVisible();
  });

  it("logs a note's edit, and gives an admin Delete alone", async () => {
    const { unmount } = await render(<NoteChangesExample />);
    await page.getByRole("button", { name: staffCopy.notes.edit }).click();
    await page.getByRole("button", { name: staffCopy.notes.save }).click();
    await expect.poll(() => log().nth(0).query()?.textContent).toMatch(/^edit\(/);
    await unmount();
    await render(<NoteChangesExample editable={false} />);
    await expect.element(page.getByRole("button", { name: staffCopy.notes.delete })).toBeVisible();
    await expect.element(page.getByRole("button", { name: staffCopy.notes.edit })).not.toBeInTheDocument();
  });

  it("shows a note in a history, its own or another's", async () => {
    const { unmount } = await render(<NoteEntryExample />);
    await expect.element(page.getByRole("button", { name: staffCopy.notes.edit })).toBeVisible();
    await unmount();
    await render(<NoteEntryExample own={false} />);
    await expect.element(page.getByText(staffCopy.notes.edited, { exact: false })).toBeVisible();
  });

  it("logs recording an opt-out", async () => {
    await render(<OptOutFormExample opened />);
    const words = staffCopy.supporters.detail.permissions.recordOptOut;
    await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
    const newsletter = staffCopy.supporters.detail.permissions.topics.newsletter;
    await page.getByRole("button", { name: `${newsletter}, jane.smith@example.com (${words.ways.email})` }).click();
    await page.getByRole("textbox", { name: words.how }).fill("At the stall");
    await page.getByRole("button", { name: words.record }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent(
        'record({"supporterId":"1","choice":"email|newsletter|jane.smith@example.com","how":"At the stall"})',
      );
  });

  it("logs an event's save in the lists, or says there are none", async () => {
    const { unmount } = await render(<EventColumnsExample grouping="owner" />);
    await page
      .getByRole("listitem")
      .filter({ hasText: "AI risk talk" })
      .getByRole("button", { name: staffCopy.events.edit })
      .click();
    const form = page.getByRole("form", { name: staffCopy.events.editLabel("AI risk talk") });
    await form.getByLabelText(staffCopy.events.owner).selectOptions("sean@pauseai.uk");
    await form.getByRole("button", { name: staffCopy.events.save }).click();
    await expect.poll(() => log().nth(0).query()?.textContent).toMatch(/^save\(/);
    await unmount();
    await render(<EventColumnsExample grouping="tag" none />);
    await expect.element(page.getByText(staffCopy.events.noneFound)).toBeVisible();
  });

  it("logs an event's save in the lists of what the filters find", async () => {
    await render(<EventsListExample params={{ group: "tag" }} />);
    await page
      .getByRole("listitem")
      .filter({ hasText: "AI risk talk" })
      .getByRole("button", { name: staffCopy.events.edit })
      .click();
    const form = page.getByRole("form", { name: staffCopy.events.editLabel("AI risk talk") });
    await form.getByLabelText(staffCopy.events.owner).selectOptions("sean@pauseai.uk");
    await form.getByRole("button", { name: staffCopy.events.save }).click();
    await expect.poll(() => log().nth(0).query()?.textContent).toMatch(/^save\(/);
  });

  it("logs an event's save in the table", async () => {
    await render(<EventsTableExample />);
    await page
      .getByRole("row")
      .filter({ hasText: "AI risk talk" })
      .getByRole("button", { name: staffCopy.events.edit })
      .click();
    const form = page.getByRole("form", { name: staffCopy.events.editLabel("AI risk talk") });
    await form.getByLabelText(staffCopy.events.owner).selectOptions("sean@pauseai.uk");
    await form.getByRole("button", { name: staffCopy.events.save }).click();
    await expect.poll(() => log().nth(0).query()?.textContent).toMatch(/^save\(/);
    expect(document.querySelector("[role=status]")!.textContent).toBe("");
  });

  it("logs an event's save, and says whom it emailed", async () => {
    await render(<EventsTableExample emailed />);
    await page
      .getByRole("row")
      .filter({ hasText: "AI risk talk" })
      .getByRole("button", { name: staffCopy.events.edit })
      .click();
    const form = page.getByRole("form", { name: staffCopy.events.editLabel("AI risk talk") });
    await form.getByLabelText(staffCopy.events.owner).selectOptions("sean@pauseai.uk");
    await form.getByRole("button", { name: staffCopy.events.save }).click();
    await expect.poll(() => log().nth(0).query()?.textContent).toMatch(/^save\(/);
    await expect
      .poll(() => document.querySelector("[role=status]")?.textContent)
      .toContain(staffCopy.events.emailed(["sean@pauseai.uk", "joseph@pauseai.uk"], "sean@pauseai.uk"));
  });

  it("closes a Notice with its ×, and opens it again", async () => {
    await render(<NoticeExample />);
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Open it again" }).click();
    await expect.element(page.getByRole("button", { name: "Close" })).toBeVisible();
  });

  it("logs a held import's apply and discard", async () => {
    await render(<HeldImportExample />);
    await page.getByRole("button", { name: staffCopy.politicianImports.apply }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('decide({"id":"4","job":"import-parliament","decision":"apply"})');
    await page.getByRole("button", { name: staffCopy.politicianImports.discard }).click();
    await expect
      .element(log().nth(1))
      .toHaveTextContent('decide({"id":"4","job":"import-parliament","decision":"discard"})');
  });

  it("logs clearing a politician's signature on their page", async () => {
    await render(<PoliticianDetailsExample />);
    const letter = page
      .getByRole("region", { name: staffCopy.politician.statusesTitle })
      .getByRole("group", { name: "Example Letter to the PM" });
    await letter.getByText(staffCopy.politician.edit, { exact: true }).click();
    await letter.getByRole("radio", { name: staffCopy.politician.clearAnswer }).click();
    await letter.getByLabelText(staffCopy.politician.note).fill("Their office wrote");
    await letter.getByRole("button", { name: staffCopy.politician.save }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent(
        'setStatus({"politicianId":"7","ask":"frontier-ai-letter","note":"Their office wrote","status":""})',
      );
  });

  it("shows a politician's letters without who wrote them", async () => {
    await render(<PoliticianDetailsExample fromAirtable senders={false} />);
    await expect
      .element(
        page
          .getByRole("region", { name: staffCopy.politician.correspondence.title })
          .getByText(staffCopy.politician.history.unsignedLetter),
      )
      .toBeVisible();
    await expect.element(page.getByText(exampleLetter.senderName)).not.toBeInTheDocument();
  });

  it("logs a draft just made's first save, with its greeting", async () => {
    await render(<MailingWriterExample draft={false} />);
    await subject().fill("Hello");
    await expect.poll(() => log().nth(0).query()?.textContent).toMatch(/^saveMailing\(12, 1, \{"body"/);
  });

  it("logs a draft's save", async () => {
    await render(<MailingWriterExample draft />);
    await subject().fill("Hello again");
    await expect.poll(() => log().last().query()?.textContent).toMatch(/^saveMailing\(/);
  });

  it("logs a file taken off a draft", async () => {
    await render(<MailingWriterExample draft />);
    await page.getByRole("button", { name: staffCopy.mailingPages.removeFile("programme.pdf") }).click();
    await expect.poll(() => log().last().query()?.textContent).toMatch(/^detachFromMailing\(12, /);
  });

  it("logs a row ticked or unticked while choosing who a mailing is for", async () => {
    await render(<ChoosingListExample />);
    await page.getByRole("checkbox", { name: staffCopy.mailingPages.tick("Polly Placeholder") }).click();
    await expect.poll(() => log().last().query()?.textContent).toBe("pickPolitician(12, 7, false)");
  });

  it("logs names pasted, and ticking everyone they found", async () => {
    const { unmount } = await render(<PasteFormExample />);
    await page.getByRole("textbox", { name: staffCopy.mailingPages.pasteLabel }).fill("Polly Placeholder");
    await page.getByRole("button", { name: staffCopy.mailingPages.pasteTick }).click();
    await expect.poll(() => log().last().query()?.textContent).toMatch(/^pasteNames\(/);
    await unmount();
    await render(<ChoosingListExample pasted />);
    await page.getByRole("checkbox", { name: staffCopy.mailingPages.pastedTickAll(1) }).click();
    await expect.poll(() => log().last().query()?.textContent).toBe("pickMany(12, [7], false)");
    await page.getByRole("button", { name: staffCopy.mailingPages.untickAll }).click();
    await expect.poll(() => log().last().query()?.textContent).toMatch(/^untickAll\(12/);
  });

  it("logs each tick box's click", async () => {
    await render(<PickBoxExample />);
    for (const name of ["Ticked", "Not ticked", "Some ticked"]) await page.getByRole("checkbox", { name }).click();
    await expect
      .poll(() =>
        log()
          .all()
          .map((item) => item.element().textContent),
      )
      .toEqual(["pick(false)", "pick(true)", "pick(true)"]);
  });

  it("lists politicians with no buttons", async () => {
    await render(<PoliticianTableExample />);
    expect(page.getByRole("button").all()).toHaveLength(0);
  });

  it("logs an address added to a politician's, and says what the server answered", async () => {
    await render(<AddAliasFormExample result={{ added: true }} />);
    await page.getByLabelText(staffCopy.politician.aliases.address).fill("polly@example.com");
    await page.getByRole("button", { name: staffCopy.politician.aliases.add }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('addAlias({"politicianId":"7","address":"polly@example.com"})');
    await expect.element(page.getByRole("status")).toHaveTextContent(staffCopy.politician.aliases.added);
  });

  it("logs a politician's salutation and a Lord's email, and says what the server answered", async () => {
    const { rerender } = await render(<EditPoliticianFormExample lord result={{ saved: false, why: "shared" }} />);
    const words = staffCopy.politician.editDetails;
    await page.getByLabelText(words.email).fill("contactholmember@parliament.uk");
    await page.getByRole("button", { name: words.save }).click();
    await expect.element(page.getByRole("status")).toHaveTextContent(words.refused.shared);
    await expect
      .element(log().nth(0))
      .toHaveTextContent(
        'editDetails({"politicianId":"7","salutation":"Lord Seedling","email":"contactholmember@parliament.uk"})',
      );
    await rerender(<EditPoliticianFormExample result={{ saved: true }} />);
    await expect.element(page.getByLabelText(words.email)).not.toBeInTheDocument();
    await page.getByRole("button", { name: words.save }).click();
    await expect.element(page.getByRole("status").last()).toHaveTextContent(words.saved);
  });

  it("logs a marker's press, turning it the other way", async () => {
    await render(<PoliticianMarksExample test />);
    await page.getByRole("button", { name: staffCopy.politician.personalConnection }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('setMark({"politicianId":"7","mark":"personalConnection","on":"true"})');
    await expect.element(page.getByText(staffCopy.politicians.flags.test)).toBeVisible();
  });

  it("says when no politician matches", async () => {
    await render(<PoliticianTableEmptyExample />);
    await expect.element(page.getByText(staffCopy.politicians.none)).toBeVisible();
  });
});
