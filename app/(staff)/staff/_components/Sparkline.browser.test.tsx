import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import Sparkline from "./Sparkline";

describe("Sparkline", () => {
  const values = [70, 105, 376, 144, 220, 338, 498, 277];
  const labels = values.map((value, i) => `Week ${i}: ${value}`);

  it("draws the counts as a line with the last point marked, and says a point's count when pointed at", async () => {
    await render(
      <Sparkline values={values} labels={labels} name="Registrations" from="28 Aug 2026" to="23 Oct 2026" />,
    );
    const chart = page.getByRole("img", { name: "Registrations" });
    await expect.element(chart).toBeVisible();
    // The points: the lines after the line of counts, the first being the baseline.
    const circles = chart.element().querySelectorAll("polyline ~ line");
    expect(circles).toHaveLength(8);
    expect([...circles].filter((circle) => /marked/.test(circle.getAttribute("class") ?? ""))).toHaveLength(1);
    expect(circles[7].getAttribute("class")).toMatch(/marked/);
    await expect.element(page.getByText("28 Aug 2026")).toBeVisible();
    await expect.element(page.getByText("23 Oct 2026")).toBeVisible();
    await expect.element(page.getByRole("status")).not.toBeInTheDocument();

    const box = chart.element().getBoundingClientRect();
    const pointAt = (type: string, x: number) =>
      chart
        .element()
        .dispatchEvent(new PointerEvent(type, { clientX: box.left + x, clientY: box.top + 5, bubbles: true }));
    pointAt("pointermove", 1);
    await expect.element(page.getByRole("status")).toHaveTextContent(labels[0]);
    expect(circles[0].getAttribute("class")).toMatch(/marked/);
    pointAt("pointerdown", box.width - 1);
    await expect.element(page.getByRole("status")).toHaveTextContent(labels[7]);
    expect(circles[0].getAttribute("class")).not.toMatch(/marked/);
    // React hears the pointer leaving from pointerout.
    pointAt("pointerout", -10);
    await expect.element(page.getByRole("status")).not.toBeInTheDocument();
  });

  it("draws a flat line for one count, or counts all the same", async () => {
    const { rerender } = await render(<Sparkline values={[5]} labels={["Only: 5"]} name="One" from="a" to="b" />);
    const points = () => page.getByRole("img").element().querySelector("polyline")!.getAttribute("points")!;
    expect(points()).not.toMatch(/NaN/);
    await rerender(<Sparkline values={[2, 2, 2]} labels={["a", "b", "c"]} name="Flat" from="a" to="b" />);
    expect(points()).not.toMatch(/NaN/);
    expect(
      new Set(
        points()
          .split(" ")
          .map((point) => point.split(",")[1]),
      ).size,
    ).toBe(1);
  });

  it("puts zero at the bottom, on the baseline, even when no count is zero, and draws counts of all zero there", async () => {
    const { rerender } = await render(<Sparkline values={[50, 100]} labels={["a", "b"]} name="High" from="a" to="b" />);
    const chart = () => page.getByRole("img").element();
    const baseline = () => Number(chart().querySelector("line")!.getAttribute("y1"));
    const heights = () =>
      chart()
        .querySelector("polyline")!
        .getAttribute("points")!
        .split(" ")
        .map((point) => Number(point.split(",")[1]));
    // Half the top count is halfway between the top point and the baseline.
    const [half, top] = heights();
    expect(half).toBeCloseTo((top + baseline()) / 2);
    await rerender(<Sparkline values={[0, 0]} labels={["a", "b"]} name="None" from="a" to="b" />);
    expect(heights()).toEqual([baseline(), baseline()]);
  });
});
