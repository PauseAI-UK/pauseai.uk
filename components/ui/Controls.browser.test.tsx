import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Checkbox, FileInput, Radio, Segmented, Select, TextArea, TextInput, Toggles } from "./Controls";

describe("the plain controls", () => {
  it("renders a text box, a select, a text area and a file picker, passing their props through", async () => {
    await render(
      <form>
        <TextInput aria-label="Name" defaultValue="Jane" />
        <Select aria-label="House" defaultValue="lords">
          <option value="commons">Commons</option>
          <option value="lords">Lords</option>
        </Select>
        <TextArea aria-label="Note" defaultValue="Hello" />
        <FileInput aria-label="File" accept=".csv" />
      </form>,
    );
    await expect.element(page.getByRole("textbox", { name: "Name" })).toHaveValue("Jane");
    await expect.element(page.getByRole("combobox", { name: "House" })).toHaveValue("lords");
    await expect.element(page.getByRole("textbox", { name: "Note" })).toHaveValue("Hello");
    await expect.element(page.getByLabelText("File")).toHaveAttribute("type", "file");
  });
});

describe("Checkbox", () => {
  it("says whether it's now ticked, boxed or not", async () => {
    const changed = vi.fn();
    await render(
      <>
        <Checkbox checked={false} onChange={changed}>
          Plain
        </Checkbox>
        <Checkbox checked boxed onChange={changed}>
          Boxed
        </Checkbox>
      </>,
    );
    await page.getByRole("checkbox", { name: "Plain" }).click();
    await page.getByRole("checkbox", { name: "Boxed" }).click();
    expect(changed.mock.calls).toEqual([[true], [false]]);
    expect(page.getByText("Boxed").element().parentElement!.className).not.toBe(
      page.getByText("Plain").element().parentElement!.className,
    );
  });
});

describe("Radio", () => {
  it("says it's been chosen", async () => {
    const chosen = vi.fn();
    await render(
      <label>
        <Radio name="size" value="small" onChange={chosen} /> Small
      </label>,
    );
    await page.getByRole("radio", { name: "Small" }).click();
    expect(chosen).toHaveBeenCalledOnce();
  });
});

describe("Toggles", () => {
  const options = [
    { value: "news", label: "News" },
    { value: "events", label: "Events" },
    { value: "asks", label: "Asks" },
  ] as const;
  type Topic = (typeof options)[number]["value"];

  it("turns one on or off, giving every one on in the options' order, with a joiner between", async () => {
    const changed = vi.fn();
    await render(
      <Toggles<Topic> label="Topics" options={[...options]} values={["asks"]} onChange={changed} joiner="or" />,
    );
    await expect.element(page.getByRole("button", { name: "Asks" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "News" }).click();
    await page.getByRole("button", { name: "Asks" }).click();
    expect(changed.mock.calls).toEqual([[["news", "asks"]], [[]]]);
    expect(page.getByRole("group", { name: "Topics" }).element().textContent).toBe("NewsorEventsorAsks");
  });

  it("keeps the last one on when it may not be turned off, and does nothing while busy", async () => {
    const changed = vi.fn();
    const view = await render(
      <Toggles<Topic> label="Topics" options={[...options]} values={["asks"]} onChange={changed} min={1} />,
    );
    await page.getByRole("button", { name: "Asks" }).click();
    expect(changed).not.toHaveBeenCalled();
    await view.rerender(
      <Toggles<Topic> label="Topics" options={[...options]} values={["asks"]} onChange={changed} busy waiting="news" />,
    );
    await expect.element(page.getByRole("group", { name: "Topics" })).toHaveAttribute("aria-busy", "true");
    await expect.element(page.getByRole("button", { name: "News" })).toHaveAttribute("aria-busy", "true");
    await expect.element(page.getByRole("button", { name: "Events" })).not.toHaveAttribute("aria-busy");
    await page.getByRole("button", { name: "Events" }).click();
    expect(changed).not.toHaveBeenCalled();
  });

  it("can't be changed when disabled", async () => {
    await render(<Toggles<Topic> label="Topics" options={[...options]} values={[]} onChange={() => {}} disabled />);
    await expect.element(page.getByRole("button", { name: "News" })).toBeDisabled();
  });
});

describe("Segmented", () => {
  it("picks one, with an icon before its words, and a quiet one set apart", async () => {
    const picked = vi.fn();
    await render(
      <Segmented
        label="Answer"
        value="yes"
        onChange={picked}
        options={[
          { value: "yes", label: "Yes", icon: <span>✓</span> },
          { value: "no", label: "No" },
          { value: "none", label: "No answer", quiet: true },
        ]}
      />,
    );
    await expect.element(page.getByRole("radio", { name: "✓Yes" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "No", exact: true }).click();
    expect(picked).toHaveBeenCalledWith("no");
    const quiet = page.getByRole("radio", { name: "No answer" }).element().className;
    expect(quiet).not.toBe(page.getByRole("radio", { name: "No", exact: true }).element().className);
  });

  it("does nothing while busy, the option waited for showing it, and an option or all can be disabled", async () => {
    const picked = vi.fn();
    const options = [
      { value: true, label: "On" },
      { value: false, label: "Off", disabled: true },
    ];
    const view = await render(
      <Segmented label="Switch" value={false} onChange={picked} options={options} busy waiting={true} />,
    );
    await expect.element(page.getByRole("radiogroup", { name: "Switch" })).toHaveAttribute("aria-busy", "true");
    await expect.element(page.getByRole("radio", { name: "On" })).toHaveAttribute("aria-busy", "true");
    await expect.element(page.getByRole("radio", { name: "Off" })).toBeDisabled();
    await page.getByRole("radio", { name: "On" }).click();
    expect(picked).not.toHaveBeenCalled();
    await view.rerender(<Segmented label="Switch" value={false} onChange={picked} options={options} disabled />);
    await expect.element(page.getByRole("radio", { name: "On" })).toBeDisabled();
  });
});
