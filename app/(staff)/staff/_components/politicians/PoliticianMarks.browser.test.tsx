import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { PoliticianMarksExample } from "./PoliticianMarks.gallery.client";
import { politiciansCopy } from "./copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";

describe("PoliticianMarks's examples in the gallery", () => {
  // Their Server Actions are logged, not sent: pressing each adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("logs a marker's press, turning it the other way", async () => {
    await render(<PoliticianMarksExample test />);
    await page.getByRole("switch", { name: politiciansCopy.politician.personalConnection }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('setMark({"politicianId":"7","mark":"personalConnection","on":"true"})');
    // A test politician's switch is on, and can't be moved.
    const test = page.getByRole("switch", { name: staffVocabulary.politicianFlags.test });
    await expect.element(test).toBeChecked();
    await expect.element(test).toBeDisabled();
  });
});
