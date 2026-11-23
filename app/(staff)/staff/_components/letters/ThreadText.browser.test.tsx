import { expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import ThreadText from "./ThreadText";

it("shows an email's italics", async () => {
  const screen = await render(<ThreadText text={"See _Confronting AI Risk_, snake_case"} />);
  expect(screen.container.querySelector("em")?.textContent).toBe("Confronting AI Risk");
  expect(screen.container.textContent).toBe("See Confronting AI Risk, snake_case");
});

it("shows an email's words, its bold, and its links leaving the site", async () => {
  const screen = await render(
    <ThreadText text={"Dear Jane,\n\n*Out now: https://example.org/a\n<https://example.org/a>*\n\nBye"} />,
  );
  const link = page.getByRole("link", { name: "https://example.org/a" });
  await expect.element(link).toHaveAttribute("href", "https://example.org/a");
  await expect.element(link).toHaveAttribute("target", "_blank");
  expect(link.element().closest("strong")?.textContent).toContain("Out now:");
  expect(screen.container.textContent).toContain("Bye");
});

it("shows an email's lists as lists, nested and numbered, what it quotes set apart, and Outlook's rule as a line", async () => {
  const screen = await render(
    <div style={{ whiteSpace: "pre-wrap" }}>
      <ThreadText
        text={`It asks for:\n- a summit\n  3. first\n- a treaty\n\nOn Mon, Jo wrote:\n> Will you?\n${"_".repeat(32)}\nFrom: Jo`}
      />
    </div>,
  );
  const bullets = screen.container.querySelector("ul")!;
  expect([...bullets.children].map((item) => item.firstChild?.textContent)).toEqual(["a summit", "a treaty"]);
  const numbered = bullets.querySelector("ol")!;
  expect(numbered.start).toBe(3);
  expect(numbered.textContent).toBe("first");
  expect(screen.container.querySelector("blockquote")?.textContent).toBe("Will you?");
  expect(screen.container.querySelector("hr")).not.toBeNull();
  expect(screen.container.textContent).toContain("It asks for:\n");
  expect(screen.container.textContent).toContain("From: Jo");
});
