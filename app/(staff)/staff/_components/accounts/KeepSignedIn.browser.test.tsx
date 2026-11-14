import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import KeepSignedIn from "./KeepSignedIn";
import { accountsCopy } from "./copy";

describe("KeepSignedIn", () => {
  it("is unticked to start, and sends remember=on once ticked", async () => {
    await render(
      <form data-testid="f">
        <KeepSignedIn />
      </form>,
    );
    const box = page.getByRole("checkbox", { name: accountsCopy.login.keep });
    await expect.element(box).not.toBeChecked();
    const data = () => new FormData(page.getByTestId("f").element() as HTMLFormElement);
    expect(data().get("remember")).toBeNull();
    await box.click();
    expect(data().get("remember")).toBe("on");
  });
});
