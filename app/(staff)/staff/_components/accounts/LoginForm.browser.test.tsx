import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import LoginForm from "./LoginForm";
import { accountsCopy } from "./copy";

describe("LoginForm", () => {
  it("is the button to Google, on its own at first, with the box to stay signed in", async () => {
    await render(<LoginForm />);
    await expect.element(page.getByText(accountsCopy.login.intro)).toBeVisible();
    await expect.element(page.getByRole("button", { name: accountsCopy.login.button })).toBeVisible();
    expect(document.querySelector("form")!.getAttribute("action")).toBe("/staff/api/google/start");
    await expect.element(page.getByRole("checkbox", { name: accountsCopy.login.keep })).not.toBeChecked();
    await expect.element(page.getByText(accountsCopy.login.failed)).not.toBeInTheDocument();
    await expect.element(page.getByText(accountsCopy.login.other)).not.toBeInTheDocument();
    expect(document.querySelector('input[name="next"]')).toBeNull();
  });

  it("passes on the page to go to once logged in", async () => {
    await render(<LoginForm next="/staff/letters" />);
    expect(document.querySelector<HTMLInputElement>('input[name="next"]')!.value).toBe("/staff/letters");
  });

  it("says why the last try didn't work", async () => {
    await render(<LoginForm failed="1" other="1" />);
    await expect.element(page.getByText(accountsCopy.login.failed)).toBeVisible();
    await expect.element(page.getByText(accountsCopy.login.other)).toBeVisible();
    await expect.element(page.getByRole("button", { name: accountsCopy.login.button })).toBeVisible();
  });
});
