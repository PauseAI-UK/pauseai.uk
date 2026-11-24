import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Checkbox, TextInput } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import { refused, type FormResult } from "@/lib/form-result";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { MenuSubmitExample } from "./MenuSubmit.gallery.client";
import { Refusal, RefusalPlace, RefusedTextArea, RefusedTextInput, ResultForm } from "./ResultForm";
import { FailedExample, GoneExample, TypedWrongExample } from "./ResultForm.gallery.client";

const at = vi.hoisted(() => ({ path: "/staff/politicians", search: "party=Labour" }));
vi.mock("next/navigation", () => ({
  usePathname: () => at.path,
  useSearchParams: () => new URLSearchParams(at.search),
}));

afterEach(() => {
  at.path = "/staff/politicians";
  at.search = "party=Labour";
});

type Reason = "blank" | "short" | "gone";
type Action = (form: FormData) => Promise<FormResult<Reason, { id?: number }>>;

const SAYS = { blank: "Give it a name.", short: "Say more.", gone: "Someone has deleted it." };

/** A box to tick, held in state as the kit's are. */
function Sure() {
  const [sure, setSure] = useState(false);
  return (
    <Checkbox name="sure" checked={sure} onChange={setSure}>
      Sure
    </Checkbox>
  );
}

/** A page with a form of two fields, each wrong for a reason of its own, under the place a page says things. */
function Example({
  action,
  ...props
}: {
  action: Action;
  done?: (result: { ok: true; id?: number }, sent: FormData) => void;
  onReset?: () => void;
}) {
  return (
    <RefusalPlace>
      <ResultForm action={action} says={SAYS} atTop={["gone"]} aria-label="Name it" {...props}>
        <Field label="Name">
          <RefusedTextInput name="name" wrong={["blank"]} />
        </Field>
        <Field label="Note">
          <RefusedTextArea name="note" defaultValue="A note" wrong={["short"]} />
        </Field>
        <Field label="Why">
          <TextInput name="why" aria-invalid={false} />
        </Field>
        <Sure />
        <Refusal />
        <button type="submit">Save</button>
      </ResultForm>
    </RefusalPlace>
  );
}

const answers = (...results: Awaited<ReturnType<Action>>[]) => {
  const action = vi.fn<Action>();
  for (const result of results) action.mockResolvedValueOnce(result);
  return action;
};
const name = () => page.getByRole("textbox", { name: "Name" });
const note = () => page.getByRole("textbox", { name: "Note" });
const save = () => page.getByRole("button", { name: "Save" });

describe("ResultForm", () => {
  it("says nothing of a form that's done, and hands on its answer", async () => {
    const done = vi.fn();
    await render(<Example action={answers({ ok: true, id: 4 })} done={done} />);
    await name().fill("One");
    await save().click();
    await expect.poll(() => done.mock.calls.length).toBe(1);
    expect(done.mock.calls[0][0]).toEqual({ ok: true, id: 4 });
    expect((done.mock.calls[0][1] as FormData).get("name")).toBe("One");
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    await expect.element(name()).not.toHaveAttribute("aria-invalid");
  });

  it("says why it was refused where its Refusal is, marking the field it's about, and keeps what was typed", async () => {
    const action = answers(refused("blank"), refused("short"), { ok: true });
    const onReset = vi.fn();
    await render(<Example action={action} onReset={onReset} />);
    await note().fill("Hm");
    await page.getByRole("textbox", { name: "Why" }).fill("No name, so not done");
    await page.getByRole("checkbox", { name: "Sure" }).click();
    await save().click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(SAYS.blank);
    // Everything stays as it was typed and ticked, whichever field the refusal is about.
    await expect.element(note()).toHaveValue("Hm");
    await expect.element(page.getByRole("textbox", { name: "Why" })).toHaveValue("No name, so not done");
    await expect.element(page.getByRole("checkbox", { name: "Sure" })).toBeChecked();
    await expect.element(name()).toHaveValue("");
    await expect.element(name()).toHaveAttribute("aria-invalid", "true");
    await expect.element(note()).not.toHaveAttribute("aria-invalid");
    await save().click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(SAYS.short);
    await expect.element(note()).toHaveAttribute("aria-invalid", "true");
    await expect.element(name()).not.toHaveAttribute("aria-invalid");
    await save().click();
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    // Done, so the form is as it started, and whoever watches for its reset is told.
    await expect.element(note()).toHaveValue("A note");
    expect(onReset).toHaveBeenCalledOnce();
    expect(action.mock.calls[0][0].get("note")).toBe("Hm");
  });

  it("says in the kit's words that its action threw, marking no field", async () => {
    const action = vi.fn<Action>().mockRejectedValue(Object.assign(new Error("Server"), { digest: "1" }));
    await render(<Example action={action} />);
    await name().fill("One");
    await save().click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
    await expect.element(name()).toHaveValue("One");
    await expect.element(name()).not.toHaveAttribute("aria-invalid");
  });

  it("says at the top of the page that its thing has gone, until a form is next sent", async () => {
    const action = answers(refused("gone"), { ok: true });
    await render(<Example action={action} />);
    await save().click();
    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent(SAYS.gone);
    // Over the form, not in it.
    expect(page.getByRole("form", { name: "Name it" }).element().contains(alert.element())).toBe(false);
    await save().click();
    await expect.element(alert).not.toBeInTheDocument();
  });

  it("starts refused for what it's given, and lays its fields in a column when asked", async () => {
    await render(
      <ResultForm stack action={answers()} says={SAYS} starts="blank" aria-label="Name it">
        <Refusal />
      </ResultForm>,
    );
    await expect.element(page.getByRole("alert")).toHaveTextContent(SAYS.blank);
    expect(page.getByRole("form").element().className).toContain("stack");
  });

  it("lays its fields in a row when asked, and resets without anyone watching", async () => {
    await render(
      <ResultForm filters action={answers({ ok: true })} says={SAYS} aria-label="Name it">
        <Field label="Name">
          <RefusedTextInput name="name" aria-invalid wrong={["blank"]} />
        </Field>
        <Refusal />
        <button type="submit">Save</button>
      </ResultForm>,
    );
    expect(page.getByRole("form").element().className).toContain("filters");
    // Marked wrong when it's told it is, refused or not.
    await expect.element(name()).toHaveAttribute("aria-invalid", "true");
    await name().fill("One");
    await save().click();
    await expect.element(name()).toHaveValue("");
  });

  it("says nothing at a page's top without a place for it", async () => {
    const action = answers(refused("gone"));
    await render(
      <ResultForm action={action} says={SAYS} atTop={["gone"]}>
        <Refusal />
        <button type="submit">Save</button>
      </ResultForm>,
    );
    await save().click();
    await expect.poll(() => action.mock.calls.length).toBe(1);
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  });
});

describe("RefusalPlace", () => {
  it("drops what it was told once the page's address changes, for good", async () => {
    const place = () => <Example action={answers(refused("gone"))} />;
    const { rerender } = await render(place());
    await save().click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(SAYS.gone);
    at.search = "party=Green";
    await rerender(place());
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    at.search = "party=Labour";
    await rerender(place());
    await expect.element(save()).toBeVisible();
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the kit form's examples in the gallery", () => {
  it("are refused again, fail again, and say what's gone at the top, each time they're sent", async () => {
    await render(<TypedWrongExample />);
    await page.getByRole("button", { name: "Save" }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent("Give the filter a name.");
    await render(<TypedWrongExample box />);
    await expect.element(page.getByRole("textbox", { name: "Name" }).last()).toHaveAttribute("aria-invalid", "true");
  });

  it("fails each time it's sent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render(<FailedExample />);
    await page.getByRole("button", { name: "Update for all" }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
    vi.restoreAllMocks();
  });

  it("says at the top what's gone, once it's sent", async () => {
    await render(<GoneExample />);
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
    await page.getByRole("button", { name: "Update for all" }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent("Someone has deleted this filter.");
  });

  it("logs what a menu's item sends", async () => {
    await render(<MenuSubmitExample />);
    await page.getByRole("button", { name: "Choose" }).click();
    await page.getByRole("button", { name: "Update for everyone" }).click();
    await expect.element(page.getByRole("list", { name: "Event log" })).toHaveTextContent("update({})");
  });
});
