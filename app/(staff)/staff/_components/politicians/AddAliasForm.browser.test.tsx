import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import AddAliasForm from "./AddAliasForm";
import { AddAliasFormExample } from "./AddAliasForm.gallery.client";
import { politiciansCopy } from "./copy";

describe("AddAliasForm", () => {
  const words = politiciansCopy.politician.aliases;

  it("opens from its Add, sends the address and why, and says what happened", async () => {
    const results = [
      { added: true as const },
      { added: false as const, why: "invalid" as const },
      { added: false as const, why: "exists" as const },
      undefined,
    ];
    const sent: string[] = [];
    await render(
      <AddAliasForm
        politicianId={7}
        action={(form) => {
          sent.push(`${String(form.get("politicianId"))} ${String(form.get("address"))} ${String(form.get("note"))}`);
          return results.shift();
        }}
      />,
    );
    const status = page.getByRole("status");
    const send = async (address: string) => {
      await page.getByLabelText(words.address).fill(address);
      await page.getByLabelText(words.note).fill("Hers");
      await page.getByRole("button", { name: words.add }).click();
    };
    // Folded, it's its Add alone.
    await expect.element(page.getByLabelText(words.address)).not.toBeInTheDocument();
    await page.getByRole("button", { name: words.add }).click();
    // Added: nothing to say, as the address appears in the list; the form folds back to its Add.
    await send("a@example.com");
    await expect.element(page.getByLabelText(words.address)).not.toBeInTheDocument();
    await page.getByRole("button", { name: words.add }).click();
    await send("b@example.com");
    await expect.element(status).toHaveTextContent(words.refused.invalid);
    await send("c@example.com");
    await expect.element(status).toHaveTextContent(words.refused.exists);
    await send("d@example.com");
    await expect.element(status).toHaveTextContent("");
    expect(sent).toEqual([
      "7 a@example.com Hers",
      "7 b@example.com Hers",
      "7 c@example.com Hers",
      "7 d@example.com Hers",
    ]);
  });
});

describe("AddAliasForm's examples in the gallery", () => {
  // Their Server Actions are logged, not sent: pressing each adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("logs an address added to a politician's, saying nothing when it's added", async () => {
    await render(<AddAliasFormExample result={{ added: true }} />);
    const words = politiciansCopy.politician.aliases;
    await page.getByRole("button", { name: words.add }).click();
    await page.getByLabelText(words.address).fill("polly@example.com");
    await page.getByLabelText(words.note).fill("Her Gmail");
    await page.getByRole("button", { name: words.add }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('addAlias({"politicianId":"7","address":"polly@example.com","note":"Her Gmail"})');
    // Added, there's nothing to say: the form folds back to its Add.
    await expect.element(page.getByLabelText(words.address)).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: words.add })).toBeVisible();
  });
});
