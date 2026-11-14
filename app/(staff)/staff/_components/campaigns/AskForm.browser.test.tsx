import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { chooseDay } from "@/tests/browser/date-picker";
import { campaignsCopy } from "@/lib/campaigns/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import AskForm from "./AskForm";
import { exampleEditableAsk } from "./AsksList.examples";

describe("AskForm", () => {
  const copy = campaignsCopy.asks;
  /** A field by the start of its label: a select's name also holds its choice. */
  const field = (label: string) => page.getByLabelText(new RegExp(`^${label}`));
  const preview = () => page.getByRole("region", { name: copy.previewTitle });

  it("a new ask: the kind first, the rest in its words, previewed as typed; PauseAI asking, and no slug or Delete", async () => {
    const save = vi.fn();
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
      .element(preview().getByText(`${campaignsCopy.asks.askedThem(copy.askedBy.supporters, "event")} · 9 Dec 2026`))
      .toBeVisible();
    await expect.element(preview().getByText("Winter reception")).toBeVisible();
    expect(preview().getByRole("link").query()).toBeNull();
    await page.getByRole("button", { name: copy.save }).click();
    await expect.poll(() => save.mock.calls.length).toBe(1);
    const sent = save.mock.calls[0][0] as FormData;
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
    const save = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    await render(<AskForm ask={exampleEditableAsk} back="/staff/asks" notice="" save={save} remove={vi.fn()} />);
    const button = page.getByRole("button", { name: copy.save });
    await button.click();
    await expect.element(button).toHaveAttribute("aria-busy", "true");
    finish();
    await expect.element(button).not.toHaveAttribute("aria-busy");
  });

  it("one staff added: its slug, which doesn't change, and Delete, pressed twice", async () => {
    const remove = vi.fn();
    await render(<AskForm ask={exampleEditableAsk} back="/staff/asks" notice="saved" save={vi.fn()} remove={remove} />);
    await expect.element(page.getByRole("status")).toHaveTextContent(copy.notices.saved);
    await expect.element(page.getByText("winter-reception-dec-2026", { exact: true })).toBeVisible();
    await expect.element(field(copy.byKind.event.title)).toHaveValue("Winter reception");
    await page.getByRole("button", { name: copy.delete }).click();
    await page.getByRole("button", { name: staffVocabulary.deleteIt }).click();
    await expect.poll(() => remove.mock.calls.length).toBe(1);
    expect((remove.mock.calls[0][0] as FormData).get("slug")).toBe("winter-reception-dec-2026");
  });

  it("one answered: its kind fixed, sent all the same, and no Delete but why", async () => {
    const save = vi.fn();
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
    expect((save.mock.calls[0][0] as FormData).get("kind")).toBe("event");
  });

  it("one the code names: it can be changed and saved, but never deleted, and says why", async () => {
    const save = vi.fn();
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
    expect((save.mock.calls[0][0] as FormData).get("title")).toBe("A new name");
  });
});
