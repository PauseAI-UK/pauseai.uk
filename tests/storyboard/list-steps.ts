// The staff lists' filters, as staff turn them on and change them.
import type { Page } from "@playwright/test";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { openBubble } from "./settle";

/** Turns on a list's filter: + Filter, then the choice under the filter's name. */
export async function addFilter(page: Page, filter: string, choice: string) {
  const group = (await openBubble(page.getByRole("button", { name: staffVocabulary.filters.add })))
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: new RegExp(`^${filter}$`) }) });
  await group.locator("summary").click();
  await group.getByRole("link", { name: choice, exact: true }).click();
}

/** Changes a filter that's on, by its chip, to another choice, or with no choice, takes it off. */
export async function changeFilter(page: Page, chip: string, choice: string = staffVocabulary.filters.remove) {
  const menu = await openBubble(page.getByRole("button", { name: chip }));
  await menu.getByRole("link", { name: choice, exact: true }).click();
}
