import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import StaffMember from "./StaffMember";

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
