import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import StaffMember, { StaffSentence } from "./StaffMember";

describe("StaffMember", () => {
  it("names a staff member by their whole address, free to break before its @", async () => {
    await render(<StaffMember email="jo@pauseai.uk" />);
    await expect.element(page.getByText("jo@pauseai.uk")).toBeVisible();
    expect(document.querySelector("span")!.innerHTML).toBe("jo<wbr>@pauseai.uk");
  });

  it("names one with no @, such as a job, as it is", async () => {
    await render(<StaffMember email="nightly" />);
    await expect.element(page.getByText("nightly")).toBeVisible();
    expect(document.querySelector("wbr")).toBeNull();
  });
});

describe("StaffSentence", () => {
  it("names the staff member wherever the sentence does", async () => {
    await render(
      <p>
        <StaffSentence words={(who) => `Sent by ${who} at 10:00, after ${who}`} email="jo@pauseai.uk" />
      </p>,
    );
    expect(document.querySelector("p")!.textContent).toBe("Sent by jo@pauseai.uk at 10:00, after jo@pauseai.uk");
    expect(document.querySelectorAll("p wbr")).toHaveLength(2);
  });
});
