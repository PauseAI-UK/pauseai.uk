import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import MarchSignups from "./MarchSignups";
import SignupGoing from "./SignupGoing";

describe("SignupGoing", () => {
  it("says how many have registered, after the faces it's given", async () => {
    await render(
      <MarchSignups signups={1234}>
        <SignupGoing>
          <span>Faces</span>
        </SignupGoing>
      </MarchSignups>,
    );
    const line = page.getByText("Join 1,234+ people already registered");
    await expect.element(line).toBeVisible();
    expect(page.getByText("Faces").element().nextElementSibling).toBe(line.element());
  });

  it("says nothing when nothing around it says how many", async () => {
    const { container } = await render(<SignupGoing />);
    expect(container).toBeEmptyDOMElement();
  });
});
