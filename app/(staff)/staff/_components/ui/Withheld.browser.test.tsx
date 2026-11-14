import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import Withheld from "./Withheld";

/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("Withheld", () => {
  it("says what's kept back beside its envelope, and links nowhere", async () => {
    await render(<Withheld>Kept back</Withheld>);
    await says("Kept back");
    expect(document.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(page.getByRole("link").query()).toBeNull();
  });
});
