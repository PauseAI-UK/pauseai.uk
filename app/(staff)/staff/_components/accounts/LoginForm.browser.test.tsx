import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import LoginForm from "./LoginForm";
import { accountsCopy } from "./copy";

describe("LoginForm", () => {
  it("is the form, on its own at first, with the box to stay signed in", async () => {
    await render(<LoginForm />);
    await expect.element(page.getByText(accountsCopy.login.intro)).toBeVisible();
    await expect.element(page.getByRole("textbox", { name: accountsCopy.login.emailLabel })).toBeVisible();
    await expect.element(page.getByRole("checkbox", { name: accountsCopy.login.keep })).not.toBeChecked();
    await expect.element(page.getByText(accountsCopy.login.failed)).not.toBeInTheDocument();
    await expect.element(page.getByText(accountsCopy.login.elsewhere)).not.toBeInTheDocument();
    expect(document.querySelector('input[name="next"]')).toBeNull();
  });

  it("passes on the page to go to once logged in", async () => {
    await render(<LoginForm next="/staff/letters" />);
    expect(document.querySelector<HTMLInputElement>('input[name="next"]')!.value).toBe("/staff/letters");
  });

  it("says why the last link didn't work", async () => {
    await render(<LoginForm failed="1" elsewhere="1" />);
    await expect.element(page.getByText(accountsCopy.login.failed)).toBeVisible();
    await expect.element(page.getByText(accountsCopy.login.elsewhere)).toBeVisible();
    await expect.element(page.getByRole("button", { name: accountsCopy.login.button })).toBeVisible();
  });

  it("replaces the form once a link is sent, with a way to send another", async () => {
    await render(<LoginForm sent="1" />);
    await expect.element(page.getByRole("status")).toHaveTextContent(accountsCopy.login.sent);
    await expect
      .element(page.getByRole("link", { name: accountsCopy.login.again }))
      .toHaveAttribute("href", "/staff/login");
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
  });
});
