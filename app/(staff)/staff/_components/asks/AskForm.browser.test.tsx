import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { chooseDay } from "@/tests/browser/date-picker";
import { asksCopy } from "@/lib/asks/copy";
import type { FormResult } from "@/lib/form-result";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import AskForm from "./AskForm";
import { AskFormExample } from "./AskForm.gallery.client";
import { exampleEditableAsk } from "./AsksList.examples";

describe("AskForm", () => {
  const copy = asksCopy.asks;
  /** A field by the start of its label: a select's name also holds its choice. */
  const field = (label: string) => page.getByLabelText(new RegExp(`^${label}`));
  const preview = () => page.getByRole("region", { name: copy.previewTitle });

  /** A stand-in for the Server Action behind Save or Delete, which answers that it's done. */
  const done = () => vi.fn<(form: FormData) => Promise<FormResult<never>>>().mockResolvedValue({ ok: true });

  it("a new ask: the kind first, the rest in its words, previewed as typed; PauseAI asking, and no slug or Delete", async () => {
    const save = done();
    await render(<AskForm ask={null} back="/staff/mailings/4" notice="" save={save} remove={vi.fn()} />);
    expect(page.getByRole("button", { name: copy.delete }).query()).toBeNull();
    await expect.element(page.getByRole("button", { name: copy.save })).toBeDisabled();
    await expect
      .element(field(copy.byKind.letter.title))
      .toHaveAttribute("placeholder", copy.byKind.letter.titleExample);
    await expect.element(preview().getByRole("group", { name: copy.byKind.letter.titleExample })).toBeVisible();
    await page.getByRole("radio", { name: copy.kinds.event }).click();
    await expect.element(page.getByRole("radio", { name: copy.kinds.event })).toBeChecked();
    await field(copy.byKind.event.title).fill("Winter reception");
    await expect.element(page.getByRole("button", { name: copy.save })).toBeDisabled();
    await chooseDay(page.getByRole("button", { name: copy.byKind.event.date }), "2026-12-09");
    await field(copy.byKind.event.url).fill("luma.com/winter");
    await expect.element(page.getByText(copy.badLink)).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.save })).toBeDisabled();
    await field(copy.byKind.event.url).fill("https://luma.com/winter");
    expect(page.getByText(copy.badLink).query()).toBeNull();
    await expect.element(page.getByText("winter-reception-dec-2026", { exact: true })).toBeVisible();
    await page.getByLabelText(copy.askedBy.supporters).click();
    await page.getByLabelText(copy.askedBy.pauseai).click();
    await expect
      .element(preview().getByText(asksCopy.asks.askedThem(copy.askedBy.supporters, "event"), { exact: true }))
      .toBeVisible();
    await expect.element(preview().getByText("· 9 Dec 2026", { exact: true })).toBeVisible();
    await expect.element(preview().getByText("Winter reception")).toBeVisible();
    expect(preview().getByRole("link").query()).toBeNull();
    await page.getByRole("button", { name: copy.save }).click();
    await expect.poll(() => save.mock.calls.length).toBe(1);
    const sent = save.mock.calls[0][0];
    expect([sent.get("title"), sent.get("kind"), sent.get("back"), sent.get("slug"), sent.getAll("askedBy")]).toEqual([
      "Winter reception",
      "event",
      "/staff/mailings/4",
      null,
      ["supporters"],
    ]);
  });

  it("shows Save pending while it saves", async () => {
    let finish = () => {};
    const save = vi.fn(() => new Promise<{ ok: true }>((resolve) => (finish = () => resolve({ ok: true }))));
    await render(<AskForm ask={exampleEditableAsk} back="/staff/asks" notice="" save={save} remove={vi.fn()} />);
    const button = page.getByRole("button", { name: copy.save });
    await button.click();
    await expect.element(button).toHaveAttribute("aria-busy", "true");
    finish();
    await expect.element(button).not.toHaveAttribute("aria-busy");
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  });

  it("says over Save when a save fails, with what was typed still there", async () => {
    // As the server throws: an error with a digest, which the server has kept, so the browser tells no one.
    const save = done().mockRejectedValueOnce(Object.assign(new Error("The server threw"), { digest: "1" }));
    await render(<AskForm ask={exampleEditableAsk} back="/staff/asks" notice="" save={save} remove={vi.fn()} />);
    await field(copy.byKind.event.title).fill("Spring reception");
    const supporters = page.getByLabelText(copy.askedBy.supporters);
    const ticked = supporters.element().matches(":checked");
    await supporters.click();
    const button = page.getByRole("button", { name: copy.save });
    await button.click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
    await expect.element(field(copy.byKind.event.title)).toHaveValue("Spring reception");
    // Who asks stays as it was ticked, though React puts a form's boxes back once its action ends.
    expect(supporters.element().matches(":checked")).toBe(!ticked);
    await expect.element(button).not.toHaveAttribute("aria-busy");
    // Sent again, it saves what's there, and says no more.
    await button.click();
    await expect.poll(() => save.mock.calls.length).toBe(2);
    expect(save.mock.calls[1][0].getAll("askedBy")).toEqual(save.mock.calls[0][0].getAll("askedBy"));
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  });

  it("one staff added: its slug, which doesn't change, and Delete, pressed twice", async () => {
    const remove = done();
    await render(<AskForm ask={exampleEditableAsk} back="/staff/asks" notice="saved" save={vi.fn()} remove={remove} />);
    await expect.element(page.getByRole("status")).toHaveTextContent(copy.notices.saved);
    await expect.element(page.getByText("winter-reception-dec-2026", { exact: true })).toBeVisible();
    await expect.element(field(copy.byKind.event.title)).toHaveValue("Winter reception");
    await page.getByRole("button", { name: copy.delete }).click();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    await expect.poll(() => remove.mock.calls.length).toBe(1);
    expect(remove.mock.calls[0][0].get("slug")).toBe("winter-reception-dec-2026");
  });

  it("one answered: its kind fixed, sent all the same, and no Delete but why", async () => {
    const save = done();
    await render(
      <AskForm
        ask={{ ...exampleEditableAsk, kindFixed: true, deletable: false }}
        back="/staff/asks"
        notice="in-use"
        save={save}
        remove={vi.fn()}
      />,
    );
    await expect
      .element(page.getByRole("alert").or(page.getByRole("status")))
      .toHaveTextContent(copy.notices["in-use"]);
    await expect.element(page.getByRole("radio", { name: copy.kinds.event })).toBeDisabled();
    await expect.element(page.getByRole("radio", { name: copy.kinds.event })).toBeChecked();
    await expect.element(page.getByText(copy.kindFixed)).toBeVisible();
    expect(page.getByRole("button", { name: copy.delete }).query()).toBeNull();
    await expect.element(page.getByText(copy.notDeletable).last()).toBeVisible();
    await page.getByRole("button", { name: copy.save }).click();
    await expect.poll(() => save.mock.calls.length).toBe(1);
    expect(save.mock.calls[0][0].get("kind")).toBe("event");
  });

  it("one the code names: it can be changed and saved, but never deleted, and says why", async () => {
    const save = done();
    await render(
      <AskForm
        ask={{ ...exampleEditableAsk, named: true, deletable: false }}
        back="/staff/asks"
        notice="nonsense"
        save={save}
        remove={vi.fn()}
      />,
    );
    await expect.element(page.getByText(copy.named)).toBeVisible();
    expect(page.getByText(copy.notDeletable).query()).toBeNull();
    expect(page.getByRole("button", { name: copy.delete }).query()).toBeNull();
    await page.getByLabelText(copy.byKind[exampleEditableAsk.kind].title).fill("A new name");
    await page.getByRole("button", { name: copy.save }).click();
    await expect.poll(() => save.mock.calls.length).toBe(1);
    expect(save.mock.calls[0][0].get("title")).toBe("A new name");
  });
});

describe("AskForm's example in the gallery", () => {
  // Its Server Actions are logged, not sent: pressing each adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("logs a save", async () => {
    await render(<AskFormExample ask="added" />);
    await page.getByRole("button", { name: asksCopy.asks.save }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent(
        'save({"back":"/staff/asks","slug":"winter-reception-dec-2026","kind":"event","title":"Winter reception","date":"2026-12-09","url":"","askedBy":"pauseai"})',
      );
  });
});
