import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { buttonClass } from "@/components/ui/Button";
import { refused } from "@/lib/form-result";
import type { AddNote, DeleteNote, EditNote } from "@/lib/notes/notes";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { staffTime } from "@/lib/staff-time";
import { RefusalPlace } from "../ui/ResultForm";
import NotesCard from "./NotesCard";
import Notes, { NoteEntry, NoteText } from "./Notes";
import { exampleNoteAdmin, exampleNotes, exampleNotesAt, exampleNoteWriter } from "./Notes.examples";
import { notesCopy } from "./copy";
import { NoteEntryExample, NotesExample, NoteTextExample } from "./Notes.gallery.client";
import { NoteChangesExample } from "./NoteChanges.gallery.client";
import { NotesCardExample } from "./NotesCard.gallery.client";

// The page's address, which the place a page says things at its top reads.
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/supporters/4",
  useSearchParams: () => new URLSearchParams(),
}));

const copy = notesCopy.notes;
const notes = () => page.getByRole("list", { name: copy.title }).getByRole("listitem");
const fields = (form: FormData) => Object.fromEntries(form.entries());

/** A supporter's notes, under the place a page says things at its top, their actions answering that they're done. */
async function renderNotes(reader = exampleNoteWriter, list = exampleNotes) {
  const actions = {
    add: vi.fn<AddNote>(async () => ({ ok: true })),
    edit: vi.fn<EditNote>(async () => ({ ok: true })),
    remove: vi.fn<DeleteNote>(async () => ({ ok: true })),
  };
  await render(
    <RefusalPlace>
      <Notes supporterId={4} notes={list} reader={reader} at={exampleNotesAt} {...actions} />
    </RefusalPlace>,
  );
  return actions;
}

describe("Notes", () => {
  it("lists a supporter's notes in a card, newest first, with who wrote each, when, and whether it was edited, their addresses links", async () => {
    await renderNotes();
    await expect.element(page.getByRole("region", { name: copy.title })).toBeVisible();
    await expect.element(page.getByRole("heading", { name: copy.title })).toBeVisible();
    await expect.element(notes().nth(1)).toBeVisible();
    const text = (i: number) => notes().nth(i).element().textContent;
    expect(text(0)).toContain(`jo@pauseai.uk · ${staffTime(exampleNotes[0].createdAt)}`);
    expect(text(1)).toContain(`sam@pauseai.uk · ${staffTime(exampleNotes[1].createdAt)} · ${copy.edited}`);
    const link = notes().nth(0).getByRole("link", { name: "https://example.org/slides/leeds-2026" });
    await expect.element(link).toHaveAttribute("href", "https://example.org/slides/leeds-2026");
    await expect.element(link).toHaveAttribute("target", "_blank");
    await expect
      .element(notes().nth(1).getByRole("link", { name: "www.example.com/rota" }))
      .toHaveAttribute("href", "https://www.example.com/rota");
  });

  it("shows why they joined, their own words from the WhatsApp waiting room, last, with no way to change it", async () => {
    const at = new Date("2026-10-16T12:52:00Z");
    await render(
      <Notes
        supporterId={4}
        notes={exampleNotes}
        reader={exampleNoteWriter}
        at={exampleNotesAt}
        reason={{ words: "I'm a parent worried about AI", at }}
        add={vi.fn()}
        edit={vi.fn()}
        remove={vi.fn()}
      />,
    );
    const last = notes().nth(exampleNotes.length);
    await expect.element(last).toHaveTextContent(`I'm a parent worried about AI${copy.joiningReason(staffTime(at))}`);
    expect(last.getByRole("button").elements()).toHaveLength(0);
  });

  it("lets the writer edit only her note still young enough: Save, Cancel, and Delete, red, while editing", async () => {
    const { edit, remove } = await renderNotes();
    const first = notes().nth(0);
    await expect.element(notes().nth(1).getByRole("button", { name: copy.edit })).not.toBeInTheDocument();
    await expect.element(notes().nth(2).getByRole("button")).not.toBeInTheDocument();
    // Not editing: Edit alone, no Delete.
    await expect.element(first.getByRole("button", { name: copy.delete })).not.toBeInTheDocument();
    await first.getByRole("button", { name: copy.edit }).click();
    // Editing: no Edit; the field, focused, with its text, in place of the text.
    await expect.element(first.getByRole("button", { name: copy.edit })).not.toBeInTheDocument();
    await expect.element(first.getByRole("link")).not.toBeInTheDocument();
    const field = first.getByRole("textbox", { name: copy.note });
    await expect.element(field).toHaveFocus();
    await expect.element(field).toHaveValue(exampleNotes[0].body);
    await field.fill("Never saved");
    await first.getByRole("button", { name: copy.cancel }).click();
    await expect.element(field).not.toBeInTheDocument();
    await expect.element(first.getByRole("link")).toBeVisible();
    expect(edit).not.toHaveBeenCalled();
    await first.getByRole("button", { name: copy.edit }).click();
    await first.getByRole("textbox", { name: copy.note }).fill("Spoke in Leeds");
    await first.getByRole("button", { name: copy.save }).click();
    expect(fields(edit.mock.calls[0][0])).toEqual({ id: "3", body: "Spoke in Leeds" });
    // Ctrl+Enter saves too; Enter alone is a new line.
    await first.getByRole("button", { name: copy.edit }).click();
    await first.getByRole("textbox", { name: copy.note }).fill("Spoke");
    await userEvent.keyboard("{Enter}in Leeds{Control>}{Enter}{/Control}");
    expect(fields(edit.mock.calls[1][0])).toEqual({ id: "3", body: "Spoke\nin Leeds" });
    // Saved, it closes.
    await expect.element(first.getByRole("button", { name: copy.edit })).toBeVisible();
    await first.getByRole("button", { name: copy.edit }).click();
    const del = first.getByRole("button", { name: copy.delete });
    expect(del.element().className).toBe(buttonClass({ variant: "danger", size: "small", fit: true }));
    await del.click();
    await page.getByRole("button", { name: staffVocabulary.deleteItShort }).click();
    await vi.waitFor(() => expect(remove).toHaveBeenCalled());
    expect((remove.mock.calls[0][0] as FormData).get("id")).toBe("3");
  });

  it("says so, and stays open, when the server won't change it, its day up on a page left open", async () => {
    const { edit, remove } = await renderNotes();
    edit.mockResolvedValue(refused("too-late"));
    remove.mockResolvedValue(refused("too-late"));
    const first = notes().nth(0);
    await first.getByRole("button", { name: copy.edit }).click();
    await first.getByRole("button", { name: copy.save }).click();
    // Under the field, in its form.
    const field = first.getByRole("textbox", { name: copy.note });
    await expect.element(first.getByRole("form").getByRole("alert")).toHaveTextContent(copy.tooLate.edit);
    await expect.element(field).toBeVisible();
    await expect.element(field).not.toHaveAttribute("aria-invalid");
    await first.getByRole("button", { name: copy.delete }).click();
    await page.getByRole("button", { name: staffVocabulary.deleteItShort }).click();
    await expect.element(first.getByRole("alert").filter({ hasText: copy.tooLate.delete })).toBeVisible();
    // Cancel closes it, and what it said with it.
    await first.getByRole("button", { name: copy.cancel }).click();
    await first.getByRole("button", { name: copy.edit }).click();
    await expect.element(first.getByRole("alert")).not.toBeInTheDocument();
  });

  it("says so, and stays open with what was written, when saving an edit fails", async () => {
    const { edit } = await renderNotes();
    // What a Server Action rejects with when the server threw: a digest, so the site isn't told of it again.
    edit.mockRejectedValueOnce(
      Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1" }),
    );
    const first = notes().nth(0);
    await first.getByRole("button", { name: copy.edit }).click();
    await first.getByRole("textbox", { name: copy.note }).fill("Half written");
    await first.getByRole("button", { name: copy.save }).click();
    await expect.element(first.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
    await expect.element(first.getByRole("textbox", { name: copy.note })).toHaveValue("Half written");
    // The next try starts afresh.
    await first.getByRole("button", { name: copy.save }).click();
    await expect.element(first.getByRole("alert")).not.toBeInTheDocument();
    await expect.element(first.getByRole("textbox", { name: copy.note })).not.toBeInTheDocument();
    expect(fields(edit.mock.calls[1][0])).toEqual({ id: "3", body: "Half written" });
  });

  it("says under the field that an edit of nothing but spaces won't do, keeping it", async () => {
    const { edit } = await renderNotes();
    edit.mockResolvedValue(refused("blank"));
    const first = notes().nth(0);
    await first.getByRole("button", { name: copy.edit }).click();
    const field = first.getByRole("textbox", { name: copy.note });
    await field.fill("   ");
    await first.getByRole("button", { name: copy.save }).click();
    await expect.element(first.getByRole("alert")).toHaveTextContent(copy.blank);
    await expect.element(field).toHaveAttribute("aria-invalid", "true");
    await expect.element(field).toHaveValue("   ");
  });

  it("says at the top of the page that someone has deleted the note being edited", async () => {
    const { edit } = await renderNotes();
    edit.mockResolvedValue(refused("gone"));
    const first = notes().nth(0);
    await first.getByRole("button", { name: copy.edit }).click();
    await first.getByRole("button", { name: copy.save }).click();
    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent(copy.gone.note);
    // Over the page, not in the note.
    expect(page.getByRole("region", { name: copy.title }).element().contains(alert.element())).toBe(false);
  });

  it("lets an admin delete any note still young enough, but edit none of them, saying under Delete when its day is up", async () => {
    const { remove } = await renderNotes(exampleNoteAdmin);
    for (const i of [0, 1]) {
      await expect.element(notes().nth(i).getByRole("button", { name: copy.delete })).toBeVisible();
    }
    await expect.element(notes().nth(2).getByRole("button", { name: copy.delete })).not.toBeInTheDocument();
    await expect.element(page.getByText(copy.edit, { exact: true })).not.toBeInTheDocument();
    remove.mockResolvedValue(refused("too-late"));
    await notes().nth(1).getByRole("button", { name: copy.delete }).click();
    await page.getByRole("button", { name: staffVocabulary.deleteItShort }).click();
    await expect.element(notes().nth(1).getByRole("alert")).toHaveTextContent(copy.tooLate.delete);
    expect((remove.mock.calls[0][0] as FormData).get("id")).toBe("2");
  });

  it("says when there are none, and adds one on the supporter, with what a note should be under the field", async () => {
    const { add } = await renderNotes(exampleNoteWriter, []);
    await expect.element(page.getByText(copy.none)).toBeVisible();
    await page.getByRole("button", { name: copy.write }).click();
    const field = page.getByRole("textbox", { name: copy.note });
    await expect.element(field).toHaveFocus();
    await expect.element(field).toHaveAccessibleDescription(copy.guidance);
    await field.click();
    await userEvent.keyboard("Keen{Shift>}{Enter}{/Shift}to help");
    await page.getByRole("button", { name: copy.add }).click();
    expect(fields(add.mock.calls[0][0])).toEqual({ supporterId: "4", body: "Keen\nto help" });
    // Added, it closes, for the page to show the note.
    await expect.element(page.getByRole("button", { name: copy.write })).toBeVisible();
  });

  it("says under the draft's field that a note of nothing but spaces won't do, keeping it open", async () => {
    const { add } = await renderNotes(exampleNoteWriter, []);
    add.mockResolvedValue(refused("blank"));
    await page.getByRole("button", { name: copy.write }).click();
    const field = page.getByRole("textbox", { name: copy.note });
    await field.fill("   ");
    await page.getByRole("button", { name: copy.add }).click();
    await expect.element(page.getByRole("form", { name: copy.add }).getByRole("alert")).toHaveTextContent(copy.blank);
    await expect.element(field).toHaveAttribute("aria-invalid", "true");
    await expect.element(field).toHaveValue("   ");
  });

  it("says at the top of the page that whoever a new note is about has gone", async () => {
    const { add } = await renderNotes(exampleNoteWriter, []);
    add.mockResolvedValue(refused("gone"));
    await page.getByRole("button", { name: copy.write }).click();
    await page.getByRole("textbox", { name: copy.note }).fill("Keen to help");
    await page.getByRole("button", { name: copy.add }).click();
    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent(copy.gone.supporter);
    // Over the page, not in the card.
    expect(page.getByRole("region", { name: copy.title }).element().contains(alert.element())).toBe(false);
  });

  it("says under the draft's buttons that adding it failed, keeping what was written", async () => {
    const { add } = await renderNotes(exampleNoteWriter, []);
    // What a Server Action rejects with when the server threw: a digest, so the site isn't told of it again.
    add.mockRejectedValue(Object.assign(new Error("Server"), { digest: "1" }));
    await page.getByRole("button", { name: copy.write }).click();
    await page.getByRole("textbox", { name: copy.note }).fill("Keen to help");
    await page.getByRole("button", { name: copy.add }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
    await expect.element(page.getByRole("textbox", { name: copy.note })).toHaveValue("Keen to help");
  });
});

describe("NoteEntry", () => {
  it("in a history: its label, who wrote it and no time, the history giving that", async () => {
    await render(
      <NoteEntry
        note={exampleNotes[1]}
        reader={exampleNoteWriter}
        at={exampleNotesAt}
        edit={vi.fn()}
        remove={vi.fn()}
        label="Note"
        dated={false}
      />,
    );
    await expect.element(page.getByText(`Note · sam@pauseai.uk · ${copy.edited}`)).toBeVisible();
    await expect.element(page.getByRole("button")).not.toBeInTheDocument();
  });
});

describe("NotesCard", () => {
  it("opens a draft from Write a note, closes it unsent on Cancel, and on a politician has no reminder under the field", async () => {
    const add = vi.fn<AddNote>(async () => ({ ok: true }));
    await render(
      <NotesCard target={{ name: "politicianId", value: 7 }} writer="jo@pauseai.uk" add={add}>
        {[]}
      </NotesCard>,
    );
    // An aside, as beside a record, with nothing in it yet said in its place.
    await expect.element(page.getByRole("region", { name: copy.title })).toBeVisible();
    await expect.element(page.getByText(copy.none)).toBeVisible();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
    await page.getByRole("button", { name: copy.write }).click();
    await page.getByRole("textbox", { name: copy.note }).fill("Never sent");
    await page.getByRole("button", { name: copy.cancel }).click();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
    expect(add).not.toHaveBeenCalled();
    await page.getByRole("button", { name: copy.write }).click();
    await expect.element(page.getByRole("textbox", { name: copy.note })).not.toHaveAttribute("aria-describedby");
    await expect.element(page.getByText(copy.guidance)).not.toBeInTheDocument();
    await page.getByRole("textbox", { name: copy.note }).fill("Met them");
    await page.getByRole("button", { name: copy.add }).click();
    expect(fields(add.mock.calls[0][0])).toEqual({ politicianId: "7", body: "Met them" });
    // Cmd+Enter adds one too.
    await page.getByRole("button", { name: copy.write }).click();
    await page.getByRole("textbox", { name: copy.note }).fill("Met them again");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(fields(add.mock.calls[1][0])).toEqual({ politicianId: "7", body: "Met them again" });
  });

  it("says at the top of the page that a politician a new note is about has been removed", async () => {
    await render(
      <RefusalPlace>
        <NotesCard target={{ name: "politicianId", value: 7 }} writer="jo@pauseai.uk" add={async () => refused("gone")}>
          {[]}
        </NotesCard>
      </RefusalPlace>,
    );
    await page.getByRole("button", { name: copy.write }).click();
    await page.getByRole("textbox", { name: copy.note }).fill("Met them");
    await page.getByRole("button", { name: copy.add }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.gone.politician);
  });
});

describe("NoteText", () => {
  it("keeps the lines, in its own class or one given", async () => {
    const { container } = await render(<NoteText body={"One\nTwo"} className="given" />);
    expect(container.querySelector("p.given")?.textContent).toBe("One\nTwo");
  });
});

// The examples' Server Actions are logged, not sent: pressing each adds its line to the event log.
const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

describe("the notes' examples", () => {
  it("logs a new note, as each reader sees the notes", async () => {
    const { unmount } = await render(<NotesExample as="admin" />);
    await expect.element(page.getByRole("button", { name: notesCopy.notes.delete }).nth(1)).toBeVisible();
    await unmount();
    await render(<NotesExample as="empty" />);
    await page.getByRole("button", { name: notesCopy.notes.write }).click();
    await page.getByRole("textbox", { name: notesCopy.notes.note }).fill("Met them");
    await page.getByRole("button", { name: notesCopy.notes.add }).click();
    await expect.element(log().nth(0)).toHaveTextContent('add({"supporterId":"1","body":"Met them"})');
  });

  it("shows a note's text with its links", async () => {
    const { unmount } = await render(<NotesExample />);
    await expect.element(page.getByRole("button", { name: notesCopy.notes.edit })).toBeVisible();
    await unmount();
    await render(<NoteTextExample />);
    await expect.element(page.getByRole("link", { name: "www.example.com/rota" })).toBeVisible();
  });

  it("logs a note drafted at the top of the card, and has no Write a note without its action", async () => {
    const { unmount } = await render(<NotesCardExample lines={false} />);
    await expect.element(page.getByText(notesCopy.notes.none)).toBeVisible();
    await page.getByRole("button", { name: notesCopy.notes.write }).click();
    await page.getByRole("textbox", { name: notesCopy.notes.note }).fill("Met them");
    await page.getByRole("button", { name: notesCopy.notes.add }).click();
    await expect.element(log().nth(0)).toHaveTextContent('add({"politicianId":"7","body":"Met them"})');
    await unmount();
    const plain = await render(<NotesCardExample writable={false} />);
    await expect.element(page.getByRole("button", { name: notesCopy.notes.write })).not.toBeInTheDocument();
    await plain.unmount();
    await render(<NotesCardExample />);
    await expect.element(page.getByText("Met them at the fair")).toBeVisible();
  });

  it("logs a note's edit, and gives an admin Delete alone", async () => {
    const { unmount } = await render(<NoteChangesExample />);
    await page.getByRole("button", { name: notesCopy.notes.edit }).click();
    await page.getByRole("button", { name: notesCopy.notes.save }).click();
    await expect.poll(() => log().nth(0).query()?.textContent).toMatch(/^edit\(/);
    await unmount();
    await render(<NoteChangesExample editable={false} />);
    await expect.element(page.getByRole("button", { name: notesCopy.notes.delete })).toBeVisible();
    await expect.element(page.getByRole("button", { name: notesCopy.notes.edit })).not.toBeInTheDocument();
  });

  it("shows a note in a history, its own or another's", async () => {
    const { unmount } = await render(<NoteEntryExample />);
    await expect.element(page.getByRole("button", { name: notesCopy.notes.edit })).toBeVisible();
    await unmount();
    await render(<NoteEntryExample own={false} />);
    await expect.element(page.getByText(notesCopy.notes.edited, { exact: false })).toBeVisible();
  });
});
