import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import LoginCard from "./LoginCard";
import LoginForm from "./LoginForm";

describe("LoginCard", () => {
  it("heads its form with the title, with no margin under the form", async () => {
    await render(
      <LoginCard title={staffCopy.login.title}>
        <LoginForm />
      </LoginCard>,
    );
    await expect.element(page.getByRole("heading", { level: 1, name: staffCopy.login.title })).toBeVisible();
    const form = page.getByRole("button", { name: staffCopy.login.button }).element().closest("form")!;
    expect(getComputedStyle(form).marginBottom).toBe("0px");
  });
});
