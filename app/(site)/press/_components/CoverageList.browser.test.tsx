import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import pickedStyles from "@/components/ui/Picked.module.css";
import CoverageList from "./CoverageList";
import { EXAMPLE_COVERAGE } from "./PressKit.examples";

/** The rows picked out, by their headlines. */
const picked = (container: HTMLElement) =>
  [...container.querySelectorAll(`li.${pickedStyles.picked}`)].map((li) => li.textContent);

afterEach(() => history.replaceState(null, "", location.pathname));

describe("CoverageList", () => {
  it("picks out every piece of the outlet the address names, and follows the address as it changes", async () => {
    history.replaceState(null, "", "#the-example-gazette");
    const { container } = await render(<CoverageList coverage={EXAMPLE_COVERAGE} />);
    expect(picked(container)).toEqual([
      expect.stringContaining("Protesters march on Whitehall"),
      expect.stringContaining("Campaigners call for a pause on AI"),
    ]);
    location.hash = "example-news";
    await expect.poll(() => picked(container)).toEqual([expect.stringContaining("Activists stage protest")]);
  });

  it("picks out nothing without an outlet in the address, or on the server", async () => {
    const { container } = await render(<CoverageList coverage={EXAMPLE_COVERAGE} />);
    expect(picked(container)).toEqual([]);
    history.replaceState(null, "", "#the-example-gazette");
    expect(renderToString(<CoverageList coverage={EXAMPLE_COVERAGE} />)).not.toContain(pickedStyles.picked);
  });
});
