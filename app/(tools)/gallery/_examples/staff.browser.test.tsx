import { describe, expect, it, onTestFinished, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import {
  ChangeTimeFormExample,
  DueTimeFieldsExample,
  HeldImportExample,
  MailingWriterExample,
  NoteChangesExample,
  NoteEntryExample,
  NotesCardExample,
  NotesExample,
  NoteTextExample,
  NoticeExample,
} from "./staff.client";
import { politiciansCopy } from "@/app/(staff)/staff/_components/politicians/copy";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));

// The staff examples' Server Actions are logged, not sent: pressing each adds its line to the event log.
const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");
const subject = () => page.getByLabelText(new RegExp(`^${staffCopy.mailingPages.subject}`));

describe("the staff examples", () => {
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

  it("closes a Notice with its ×, and opens it again", async () => {
    await render(<NoticeExample />);
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Open it again" }).click();
    await expect.element(page.getByRole("button", { name: "Close" })).toBeVisible();
  });

  it("logs a held import's apply and discard", async () => {
    await render(<HeldImportExample />);
    await page.getByRole("button", { name: politiciansCopy.politicianImports.apply }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('decide({"id":"4","job":"import-parliament","decision":"apply"})');
    await page.getByRole("button", { name: politiciansCopy.politicianImports.discard }).click();
    await expect
      .element(log().nth(1))
      .toHaveTextContent('decide({"id":"4","job":"import-parliament","decision":"discard"})');
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
});
