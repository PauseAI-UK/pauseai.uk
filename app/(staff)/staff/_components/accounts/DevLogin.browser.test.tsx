import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import DevLogin from "./DevLogin";
import { accountsCopy } from "./copy";

describe("DevLogin", () => {
  it("offers a button per address with what it is, each a form posting that address to the dev login route", async () => {
    await render(
      <DevLogin
        accounts={[
          { email: "admin@pauseai.uk", description: "Admin permissions" },
          { email: "jo@pauseai.uk", description: "no account" },
        ]}
      />,
    );
    const box = page.getByRole("region", { name: accountsCopy.devLogin.title });
    await expect.element(box.getByText(accountsCopy.devLogin.hint)).toBeVisible();
    const forms = box.element().querySelectorAll("form");
    expect([...forms].map((f) => [f.getAttribute("action"), f.querySelector("input")!.value])).toEqual([
      ["/staff/api/dev-login", "admin@pauseai.uk"],
      ["/staff/api/dev-login", "jo@pauseai.uk"],
    ]);
    await expect.element(box.getByRole("button", { name: "jo@pauseai.uk" })).toBeVisible();
    await expect.element(box.getByText("no account")).toBeVisible();
    expect(getComputedStyle(box.element()).borderTopStyle).toBe("dashed");
  });

  it("passes on the page to go to once logged in", async () => {
    await render(<DevLogin accounts={[{ email: "jo@pauseai.uk", description: "no account" }]} next="/staff/letters" />);
    expect(document.querySelector<HTMLInputElement>('input[name="next"]')!.value).toBe("/staff/letters");
  });

  it("is nothing outside a fixture build, where there are no accounts to offer", async () => {
    await render(<DevLogin accounts={undefined} />);
    await expect.element(page.getByRole("region", { name: accountsCopy.devLogin.title })).not.toBeInTheDocument();
  });
});
