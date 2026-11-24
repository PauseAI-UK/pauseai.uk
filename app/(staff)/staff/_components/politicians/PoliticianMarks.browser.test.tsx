import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import PoliticianMarks from "./PoliticianMarks";
import { PoliticianMarksExample } from "./PoliticianMarks.gallery.client";
import { examplePolitician } from "./PoliticianTable.examples";
import { politiciansCopy } from "./copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";

describe("PoliticianMarks", () => {
  const important = () => page.getByRole("switch", { name: politiciansCopy.politician.importantTarget });

  it("shows where each mark stands, and can't be pressed, without a way to set them", async () => {
    await render(<PoliticianMarks politician={examplePolitician} />);
    await expect.element(important()).toBeChecked();
    await expect.element(important()).toBeDisabled();
    await expect
      .element(page.getByRole("switch", { name: politiciansCopy.politician.personalConnection }))
      .toBeDisabled();
    expect(document.querySelector("form")).toBeNull();
  });

  it("says under a mark when turning it fails", async () => {
    // As the server throws: an error with a digest, which the server has kept, so the browser tells no one.
    const setMark = vi.fn().mockRejectedValue(Object.assign(new Error("The server threw"), { digest: "1" }));
    await render(<PoliticianMarks politician={examplePolitician} setMark={setMark} />);
    await important().click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
    expect(Object.fromEntries(setMark.mock.calls[0][0] as FormData)).toEqual({
      politicianId: String(examplePolitician.id),
      mark: "importantTarget",
      on: "false",
    });
  });
});

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

  it("shows each mark that's on filled, as the politicians list's tag, an important target amber; one off empty", async () => {
    await render(<PoliticianMarksExample test />);
    const lozenge = (name: string) => page.getByRole("switch", { name }).element().firstElementChild!;
    // On: an important target, in amber, and a test politician, plain.
    expect(lozenge(politiciansCopy.politician.importantTarget).className).toMatch(/tag.*amber/);
    expect(lozenge(staffVocabulary.politicianFlags.test).className).toMatch(/tag/);
    expect(lozenge(staffVocabulary.politicianFlags.test).className).not.toMatch(/amber/);
    // Off: empty, dashed.
    expect(lozenge(politiciansCopy.politician.personalConnection).className).toMatch(/off/);
    expect(getComputedStyle(lozenge(politiciansCopy.politician.personalConnection)).outlineStyle).toBe("dashed");
  });

  it("leaves out the test politicians' tag for one who isn't", async () => {
    await render(<PoliticianMarksExample />);
    await expect.element(page.getByRole("switch", { name: politiciansCopy.politician.importantTarget })).toBeVisible();
    expect(page.getByRole("switch", { name: staffVocabulary.politicianFlags.test }).query()).toBeNull();
  });
});
