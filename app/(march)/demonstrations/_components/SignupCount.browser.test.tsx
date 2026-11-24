import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { marchSignupCopy as copy } from "@/lib/content/march-signup";
import SignupCount from "./SignupCount";

describe("SignupCount", () => {
  it("says how many have registered, the number in the UK's style", async () => {
    await render(<SignupCount count={12345} />);
    await expect.element(page.getByText(`12,345 ${copy.form.count}`)).toBeVisible();
  });

  it("says nothing when Luma can't say", async () => {
    const { container } = await render(<SignupCount count={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says nobody has, rather than nothing, at none", async () => {
    await render(<SignupCount count={0} />);
    await expect.element(page.getByText(`0 ${copy.form.count}`)).toBeVisible();
  });
});
