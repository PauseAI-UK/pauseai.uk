import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused, type FormResult } from "@/lib/form-result";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { CopyMailing, DeleteDraft, ResumeBroadcast, StopMailing } from "./MailingButtons";
import { MailingButtonsExample } from "./MailingButtons.gallery.client";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.mailingPages;

/** A button's Server Action, as one that's never refused. */
type Action = (form: FormData) => Promise<FormResult<never>>;

describe("MailingButtons's examples in the gallery", () => {
  it("logs what a button sends", async () => {
    await render(<MailingButtonsExample id={5} />);
    await page.getByRole("button", { name: copy.unschedule }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent('stopMailingNow({"id":"5"})');
  });
});

describe("the mailing pages' buttons", () => {
  it("delete when pressed twice, and stop, copy and resume at once, each the mailing named", async () => {
    const forms: FormData[] = [];
    const action = vi.fn<Action>(async (form) => {
      forms.push(form);
      return { ok: true };
    });
    await render(
      <>
        <DeleteDraft id={5} action={action} says={{}} />
        <StopMailing id={6} label="Stop" action={action} says={{}} />
        <CopyMailing id={7} label="Copy" action={action} says={{}} />
        <ResumeBroadcast id={8} action={action} says={{}} />
      </>,
    );
    await page.getByRole("button", { name: copy.deleteDraft }).click();
    await expect.element(page.getByRole("button", { name: staffVocabulary.deleteIt })).toHaveFocus();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    await expect.poll(() => forms.length).toBe(1);
    for (const name of ["Stop", "Copy", copy.resume]) {
      const sent = forms.length;
      await page.getByRole("button", { name }).click();
      await expect.poll(() => forms.length).toBe(sent + 1);
    }
    expect(forms.map((form) => form.get("id"))).toEqual(["5", "6", "7", "8"]);
    expect(page.getByRole("alert").all()).toHaveLength(0);
  });

  it("say under themselves why they were refused, in the words handed in", async () => {
    await render(
      <>
        <StopMailing
          id={6}
          label="Stop"
          action={() => Promise.resolve(refused("gone"))}
          says={{ gone: "It had already stopped." }}
        />
        <DeleteDraft
          id={5}
          action={() => Promise.resolve(refused("not-draft"))}
          says={{ "not-draft": "It has been scheduled." }}
        />
      </>,
    );
    const stop = page.getByRole("button", { name: "Stop" });
    await stop.click();
    await expect.element(page.getByRole("alert")).toHaveTextContent("It had already stopped.");
    // In its own form, under the button.
    expect(stop.element().closest("form")!.contains(page.getByRole("alert").element())).toBe(true);
    await page.getByRole("button", { name: copy.deleteDraft }).click();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    await expect.element(page.getByRole("alert").last()).toHaveTextContent("It has been scheduled.");
  });

  it("turns back if the second press doesn't come, or focus goes elsewhere", async () => {
    const action = vi.fn<Action>();
    await render(
      <>
        <DeleteDraft id={5} action={action} says={{}} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await page.getByRole("button", { name: copy.deleteDraft }).click();
    await page.getByRole("button", { name: "Elsewhere" }).click();
    await expect.element(page.getByRole("button", { name: copy.deleteDraft })).toBeVisible();
    vi.useFakeTimers();
    try {
      await page.getByRole("button", { name: copy.deleteDraft }).click();
      await expect.element(page.getByRole("button", { name: staffVocabulary.deleteIt })).toBeVisible();
      await vi.advanceTimersByTimeAsync(5000);
    } finally {
      vi.useRealTimers();
    }
    await expect.element(page.getByRole("button", { name: copy.deleteDraft })).toBeVisible();
    expect(action).not.toHaveBeenCalled();
  });

  it("stays red and pending while it deletes, though the focus leaves it and the time runs out", async () => {
    let finish = () => {};
    const action = vi.fn<Action>(() => new Promise((resolve) => (finish = () => resolve({ ok: true }))));
    await render(
      <>
        <DeleteDraft id={5} action={action} says={{}} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await page.getByRole("button", { name: copy.deleteDraft }).click();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    const pressed = page.getByRole("button", { name: staffVocabulary.deleteIt });
    await expect.element(pressed).toHaveAttribute("aria-busy", "true");
    await page.getByRole("button", { name: "Elsewhere" }).click();
    vi.useFakeTimers();
    try {
      await vi.advanceTimersByTimeAsync(5000);
    } finally {
      vi.useRealTimers();
    }
    await expect.element(pressed).toHaveAttribute("aria-busy", "true");
    finish();
    await expect.element(page.getByRole("button", { name: copy.deleteDraft })).toBeVisible();
  });
});
