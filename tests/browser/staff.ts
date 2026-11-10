// What the staff components' browser tests share: a stand-in Server Action,
// and ways to read a list's menus and filter chips.
import { vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";

/** A stand-in Server Action that keeps what it was sent. */
export function action() {
  const sent: Record<string, FormDataEntryValue>[] = [];
  const fn = vi.fn((data: FormData) => {
    sent.push(Object.fromEntries(data));
  });
  return { fn, sent };
}

/** A press of a job, still running. */
export const press = { startedBy: "jo@pauseai.uk", startedAt: new Date("2026-10-21T11:47:00Z") };

/** Opens a list's Download menu, and gives its links' addresses. */
export async function downloads() {
  await page.getByRole("button", { name: staffCopy.lists.download }).click();
  const box = document.querySelector<HTMLElement>("[popover]:popover-open")!;
  return [...box.querySelectorAll("a")].map((a) => a.getAttribute("href"));
}

/** The chips of the filters on, by their words: not Consent's own button, there while it's off. */
export const chips = () =>
  page
    .getByRole("button")
    .all()
    .map((b) => b.element().textContent)
    .filter(
      (text) =>
        ![
          staffCopy.search,
          staffCopy.filters.add,
          staffCopy.filters.except,
          staffCopy.supporters.columns.subscriptions,
        ].includes(text!),
    );

/** Opens a filter's menu, by its button, and gives its links' words and addresses. */
export async function menu(button: string | RegExp) {
  await userEvent.keyboard("{Escape}");
  await page.getByRole("button", { name: button }).click();
  const box = document.querySelector<HTMLElement>("[popover]:popover-open")!;
  return [...box.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
}
