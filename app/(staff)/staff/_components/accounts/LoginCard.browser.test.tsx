import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import LoginCard from "./LoginCard";
import LoginForm from "./LoginForm";
import { accountsCopy } from "./copy";

describe("LoginCard", () => {
  it("heads its form with the title, with no margin under the form", async () => {
    await render(
      <LoginCard title={accountsCopy.login.title}>
        <LoginForm />
      </LoginCard>,
    );
    await expect.element(page.getByRole("heading", { level: 1, name: accountsCopy.login.title })).toBeVisible();
    const form = page.getByRole("button", { name: accountsCopy.login.button }).element().closest("form")!;
    expect(getComputedStyle(form).marginBottom).toBe("0px");
  });
});
