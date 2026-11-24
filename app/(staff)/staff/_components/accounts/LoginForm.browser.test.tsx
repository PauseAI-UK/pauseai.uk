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
    await expect.element(page.getByRole("status")).not.toBeInTheDocument();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
    expect(document.querySelector('input[name="next"]')).toBeNull();
  });

  it("passes on the page to go to once logged in", async () => {
    await render(<LoginForm next="/staff/letters" />);
    expect(document.querySelector<HTMLInputElement>('input[name="next"]')!.value).toBe("/staff/letters");
  });

  it("on a local build, takes an address to print a link for, and says once it's printed", async () => {
    await render(<LoginForm local printed="1" />);
    await expect.element(page.getByText(accountsCopy.login.local.intro)).toBeVisible();
    await expect.element(page.getByRole("textbox", { name: accountsCopy.login.local.emailLabel })).toBeVisible();
    await expect.element(page.getByRole("status")).toHaveTextContent(accountsCopy.login.local.printed);
    await expect.element(page.getByRole("button", { name: accountsCopy.login.local.button })).toBeVisible();
    const form = document.querySelector("form")!;
    expect([form.getAttribute("method"), form.getAttribute("action")]).toEqual(["post", "/staff/api/local-login"]);
  });

  it("says why the last try didn't work", async () => {
    await render(<LoginForm failed="1" other="1" />);
    await expect.element(page.getByText(accountsCopy.login.failed)).toBeVisible();
    await expect.element(page.getByText(accountsCopy.login.other)).toBeVisible();
    await expect.element(page.getByRole("button", { name: accountsCopy.login.button })).toBeVisible();
  });
});
