import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import StackedBars from "./StackedBars";

describe("StackedBars", () => {
  const parts = [
    { key: "a", label: "Ay" },
    { key: "b", label: "Bee" },
    { key: "c", label: "Sea" },
  ];

  it("draws each bar as tall as its share of the tallest, split into its parts, the legend only those the last bar has", async () => {
    const screen = await render(
      <StackedBars
        parts={parts}
        bars={[
          { title: "First", counts: { a: 1, b: undefined } },
          { title: "Second", counts: { a: 2, b: 2 } },
        ]}
        name="Chart"
        from="1 Oct"
        to="8 Oct"
      />,
    );
    const chart = page.getByRole("img", { name: "Chart" }).element();
    const bars = [...chart.children] as HTMLElement[];
    expect(bars.map((bar) => bar.style.height)).toEqual(["25%", "100%"]);
    expect([...bars[1].children].map((part) => (part as HTMLElement).style.flexGrow)).toEqual(["2", "2", "0"]);
    expect(screen.container.textContent).toContain("Ay · 2");
    expect(screen.container.textContent).toContain("Bee · 2");
    expect(screen.container.textContent).not.toContain("Sea");
    // The nearest bar to the pointer, at either end, kept over the chart.
    const box = chart.getBoundingClientRect();
    const point = (clientX: number) =>
      chart.dispatchEvent(new PointerEvent("pointerdown", { clientX, clientY: box.top, bubbles: true }));
    point(box.left - 5);
    await expect.poll(() => page.getByRole("status").element().textContent).toContain("First");
    point(box.right + 5);
    await expect.poll(() => page.getByRole("status").element().textContent).toContain("Second");
    const label = page.getByRole("status").element() as HTMLElement;
    expect(label.style.left).toBe("100%");
    // A line a part it holds, and wider than the room right of the chart's end would leave it.
    expect(label.textContent).toContain("Ay2");
    expect(label.textContent).not.toContain("Sea");
    expect(label.getBoundingClientRect().width).toBeGreaterThan(20);
  });

  it("leaves out of the legend a part the last bar has none of, though an earlier bar has", async () => {
    const screen = await render(
      <StackedBars
        parts={parts}
        bars={[
          { title: "First", counts: { a: 3, b: 1 } },
          { title: "Second", counts: { a: 2, b: 0 } },
        ]}
        name="Chart"
        from="1 Oct"
        to="8 Oct"
      />,
    );
    expect(screen.container.textContent).toContain("Ay · 2");
    expect(screen.container.textContent).not.toContain("Bee");
  });

  it("draws a single bar, and no height for a count of nothing, with nothing in the legend", async () => {
    const screen = await render(
      <StackedBars parts={parts} bars={[{ title: "Only", counts: {} }]} name="Chart" from="1 Oct" to="8 Oct" />,
    );
    const chart = page.getByRole("img", { name: "Chart" }).element();
    expect((chart.children[0] as HTMLElement).style.height).toBe("0%");
    expect(screen.container.textContent).not.toContain("Ay");
    chart.dispatchEvent(new PointerEvent("pointermove", { clientX: 0, bubbles: true }));
    await expect.element(page.getByRole("status")).toHaveTextContent("Only");
    expect((page.getByRole("status").element() as HTMLElement).style.left).toBe("0%");
  });
});
