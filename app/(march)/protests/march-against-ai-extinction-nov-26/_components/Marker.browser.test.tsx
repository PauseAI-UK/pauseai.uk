import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { m } from "./classes";
import MarchSignupFrame from "./MarchSignupFrame";
import Marker from "./Marker";

/** The mark's strokes, once rough-notation has drawn them beside the words. */
const strokes = () => [...document.querySelectorAll<SVGPathElement>("svg.rough-annotation path")];

/** Out of view, far down a page with room to scroll it up the window. */
const Below = ({ children }: { children: ReactNode }) => (
  <div>
    <div style={{ height: 3000 }} />
    {children}
    <div style={{ height: 3000 }} />
  </div>
);

afterEach(() => {
  vi.restoreAllMocks();
  scrollTo({ top: 0, behavior: "instant" });
});

describe("Marker", () => {
  it("underlines the words in the orange from the start, out of view too, without drawing it in", async () => {
    const { container } = await render(
      <Below>
        <p style={{ fontSize: 32 }}>
          <Marker type="underline">The words to mark</Marker>
        </p>
      </Below>,
    );
    await expect.poll(() => strokes().length).toBe(2);
    expect(strokes()[0].getAttribute("stroke")).toBe("#ff9416");
    // The pen thickens with the type: 32px text takes a 4px line.
    expect(strokes()[0].getAttribute("stroke-width")).toBe("4");
    expect(strokes()[0].style.animationName).toBe("");
    expect(container.querySelector("p > span")!.className).toBe("");
  });

  it("draws the same mark every time", async () => {
    const drawn = async () => {
      const { unmount } = await render(<Marker type="underline">Same each time</Marker>);
      await expect.poll(() => strokes().length).toBeGreaterThan(0);
      const shape = strokes().map((stroke) => stroke.getAttribute("d"));
      await unmount();
      return shape;
    };
    expect(await drawn()).toEqual(await drawn());
  });

  it("highlights a heading once it scrolls into view, in one quick sweep that gathers speed", async () => {
    await render(
      <MarchSignupFrame>
        <Below>
          <h2 style={{ fontSize: 44 }}>
            <Marker type="highlight">A heading</Marker>
          </h2>
        </Below>
      </MarchSignupFrame>,
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(strokes()).toHaveLength(0);
    // Just into view at the foot of the window isn't far enough up it.
    document.querySelector("h2")!.scrollIntoView({ block: "end", behavior: "instant" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(strokes()).toHaveLength(0);
    document.querySelector("h2")!.scrollIntoView({ block: "center", behavior: "instant" });
    await expect.poll(() => strokes().length).toBe(1);
    const sweep = getComputedStyle(strokes()[0]);
    expect(sweep.animationName).toBe("rough-notation-dash");
    expect(sweep.animationDuration).toBe("0.35s");
    expect(sweep.animationTimingFunction).toBe("ease-in");
    // Behind the words: drawn before them.
    const words = document.querySelector("h2 > span")!;
    expect(words).toHaveClass(m("marked-highlight"));
    expect(words.previousElementSibling).toBe(document.querySelector("svg.rough-annotation"));
  });

  it("circles a figure once, tilted, in a heavier pen", async () => {
    await render(
      <MarchSignupFrame>
        <p style={{ fontSize: 44 }}>
          <Marker type="circle">1,000</Marker>
        </p>
      </MarchSignupFrame>,
    );
    await expect.poll(() => strokes().length).toBe(1);
    expect(strokes()[0].getAttribute("stroke-width")).toBe("7");
    expect(getComputedStyle(strokes()[0]).rotate).toBe("-6deg");
  });

  it("highlights at once, out of view too, with reduced motion", async () => {
    const real = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((query) =>
      query === "(prefers-reduced-motion: reduce)"
        ? ({ ...real(query), matches: true } as MediaQueryList)
        : real(query),
    );
    await render(
      <Below>
        <Marker type="highlight">Still</Marker>
      </Below>,
    );
    await expect.poll(() => strokes().length).toBe(1);
    expect(strokes()[0].style.animationName).toBe("");
  });

  it("takes its mark away with it, drawn in or not", async () => {
    for (const type of ["underline", "highlight"] as const) {
      const { unmount } = await render(<Marker type={type}>Gone</Marker>);
      await expect.poll(() => strokes().length).toBeGreaterThan(0);
      await unmount();
      expect(document.querySelector("svg.rough-annotation")).toBeNull();
    }
  });
});
