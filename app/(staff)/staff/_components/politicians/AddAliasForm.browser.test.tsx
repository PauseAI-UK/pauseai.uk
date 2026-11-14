import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import AddAliasForm from "./AddAliasForm";
import { AddAliasFormExample } from "./AddAliasForm.gallery.client";
import { politiciansCopy } from "./copy";

describe("AddAliasForm", () => {
  const words = politiciansCopy.politician.aliases;

  it("sends the address, and says what happened", async () => {
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
          sent.push(`${String(form.get("politicianId"))} ${String(form.get("address"))}`);
          return results.shift();
        }}
      />,
    );
    const status = page.getByRole("status");
    const send = async (address: string) => {
      await page.getByLabelText(words.address).fill(address);
      await page.getByRole("button", { name: words.add }).click();
    };
    // Added: nothing to say, as the address appears in the list.
    await send("a@example.com");
    await expect.element(status).toHaveTextContent("");
    await send("b@example.com");
    await expect.element(status).toHaveTextContent(words.refused.invalid);
    await send("c@example.com");
    await expect.element(status).toHaveTextContent(words.refused.exists);
    await send("d@example.com");
    await expect.element(status).toHaveTextContent("");
    expect(sent).toEqual(["7 a@example.com", "7 b@example.com", "7 c@example.com", "7 d@example.com"]);
  });
});

describe("AddAliasForm's examples in the gallery", () => {
  // Their Server Actions are logged, not sent: pressing each adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("logs an address added to a politician's, saying nothing when it's added", async () => {
    await render(<AddAliasFormExample result={{ added: true }} />);
    await page.getByLabelText(politiciansCopy.politician.aliases.address).fill("polly@example.com");
    await page.getByRole("button", { name: politiciansCopy.politician.aliases.add }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('addAlias({"politicianId":"7","address":"polly@example.com"})');
    await expect.element(page.getByRole("status")).toHaveTextContent("");
  });
});
