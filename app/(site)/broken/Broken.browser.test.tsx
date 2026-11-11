import { Component, type ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import Broken, { breakNow } from "./Broken";

/** Catches what its children throw while rendering, as Next's error page does, and shows its words. */
class Caught extends Component<{ children: ReactNode }, { words?: string }> {
  state: { words?: string } = {};
  static getDerivedStateFromError(error: Error) {
    return { words: error.message };
  }
  render() {
    return this.state.words ? <p role="alert">{this.state.words}</p> : this.props.children;
  }
}

it("throws while rendering once its first button is pressed", async () => {
  // React logs what an error boundary catches.
  vi.spyOn(console, "error").mockImplementation(() => {});
  await render(
    <Caught>
      <Broken />
    </Caught>,
  );
  await expect.element(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Break while rendering" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent("Asked to break, while rendering, on try 1");
  vi.restoreAllMocks();
});

it("throws from its second button's click, leaving the page as it was", async () => {
  expect(breakNow).toThrow("Asked to break, from a click, on try 2");
  const onBreak = vi.fn();
  await render(<Broken onBreak={onBreak} />);
  await page.getByRole("button", { name: "Break from a click" }).click();
  expect(onBreak).toHaveBeenCalledTimes(1);
  await expect.element(page.getByRole("heading", { level: 1 })).toBeVisible();
});
