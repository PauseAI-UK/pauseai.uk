import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import StaffMember, { StaffSentence } from "./StaffMember";
import { StaffNames } from "./StaffNames";

const NAMES = { "jo@pauseai.uk": "Jo Bloggs" };

describe("StaffMember", () => {
  it("names a staff member by their whole address, free to break before its @", async () => {
    await render(<StaffMember email="jo@pauseai.uk" />);
    await expect.element(page.getByText("jo@pauseai.uk")).toBeVisible();
    expect(document.querySelector("span")!.innerHTML).toBe("jo<wbr>@pauseai.uk");
    expect(document.querySelector("button")).toBeNull();
  });

  it("names one with no @, such as a job, as it is", async () => {
    await render(<StaffMember email="nightly" />);
    await expect.element(page.getByText("nightly")).toBeVisible();
    expect(document.querySelector("wbr")).toBeNull();
  });

  it("opens a bubble with their name, within a sentence, where it's known", async () => {
    await render(
      <StaffNames names={NAMES}>
        <p>
          Imported by <StaffMember email="Jo@pauseai.uk" /> and <StaffMember email="sam@pauseai.uk" />
        </p>
      </StaffNames>,
    );
    const jo = page.getByRole("button", { name: "Jo@pauseai.uk" });
    await expect.element(page.getByText("Jo Bloggs")).not.toBeVisible();
    await userEvent.click(jo);
    await expect.element(page.getByText("Jo Bloggs")).toBeVisible();
    // A span, as a div can't go in a paragraph.
    expect(document.querySelector("p [popover]")!.tagName).toBe("SPAN");
    // Sam has no name, so no button.
    expect(document.querySelectorAll("button")).toHaveLength(1);
  });

  it("is underlined with dots only while the pointer is over it", async () => {
    await render(
      <StaffNames names={NAMES}>
        <StaffMember email="jo@pauseai.uk" />
      </StaffNames>,
    );
    const jo = page.getByRole("button", { name: "jo@pauseai.uk" });
    const line = () => getComputedStyle(jo.element()).textDecorationLine;
    expect(line()).toBe("none");
    await userEvent.hover(jo);
    expect(line()).toBe("underline");
    expect(getComputedStyle(jo.element()).textDecorationStyle).toBe("dotted");
  });

  it("is the address alone inside a link or button, even where the name is known", async () => {
    await render(
      <StaffNames names={NAMES}>
        <a href="/staff/me">
          <StaffMember email="jo@pauseai.uk" plain />
        </a>
      </StaffNames>,
    );
    await expect.element(page.getByRole("link", { name: "jo@pauseai.uk" })).toBeVisible();
    expect(document.querySelector("button")).toBeNull();
  });
});

describe("StaffSentence", () => {
  it("names the staff member in the sentence, opening their name", async () => {
    await render(
      <StaffNames names={NAMES}>
        <p>
          <StaffSentence words={(who) => `Sent by ${who} at 10:00, after ${who}`} email="jo@pauseai.uk" />
        </p>
      </StaffNames>,
    );
    expect(document.querySelector("p")!.innerText).toBe("Sent by jo@pauseai.uk at 10:00, after jo@pauseai.uk");
    await userEvent.click(page.getByRole("button", { name: "jo@pauseai.uk" }).first());
    await expect.element(page.getByText("Jo Bloggs").first()).toBeVisible();
  });
});
