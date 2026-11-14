import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import {
  NoteChangesExample,
  NoteEntryExample,
  NotesCardExample,
  NotesExample,
  NoteTextExample,
  NoticeExample,
} from "./staff.client";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
}));

// The staff examples' Server Actions are logged, not sent: pressing each adds its line to the event log.
const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

describe("the staff examples", () => {
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
});
