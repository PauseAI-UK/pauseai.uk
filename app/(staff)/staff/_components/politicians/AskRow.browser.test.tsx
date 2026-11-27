import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused } from "@/lib/form-result";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { exampleAsks } from "../asks/AsksList.examples";
import AskRow, { AskRows, SetAnswer, type SetStatus } from "./AskRow";
import { examplePolitician } from "./PoliticianTable.examples";
import { politiciansCopy } from "./copy";

const copy = politiciansCopy.politician;

describe("AskRow's form to set an answer", () => {
  it("says under the note that it's blank, keeping what was typed and the answer picked, then saves", async () => {
    const setStatus = vi.fn<SetStatus>().mockResolvedValueOnce(refused("blank")).mockResolvedValueOnce({ ok: true });
    const ask = exampleAsks[0]!;
    await render(
      <AskRows>
        <AskRow politician={{ ...examplePolitician, airtableId: null }} ask={ask} setStatus={setStatus} />
      </AskRows>,
    );
    const row = page.getByRole("group", { name: ask.title });
    await row.getByText(copy.edit, { exact: true }).click();
    const declined = row.getByRole("radio", { name: staffVocabulary.statuses.declined });
    await declined.click();
    const note = row.getByLabelText(copy.note);
    await note.fill("  ");
    await row.getByRole("button", { name: copy.save }).click();
    await expect.element(row.getByRole("alert")).toHaveTextContent(copy.answerRefused.blank);
    await expect.element(note).toHaveAttribute("aria-invalid", "true");
    await expect.element(note).toHaveValue("  ");
    await expect.element(declined).toBeChecked();
    await note.fill("Their office said no");
    await row.getByRole("button", { name: copy.save }).click();
    await expect.poll(() => setStatus.mock.calls.length).toBe(2);
    await expect.element(row.getByRole("alert")).not.toBeInTheDocument();
    const sent = { politicianId: String(examplePolitician.id), ask: ask.slug, status: "declined" };
    expect(setStatus.mock.calls.map(([form]) => Object.fromEntries(form))).toEqual([
      { ...sent, note: "  " },
      { ...sent, note: "Their office said no" },
    ]);
  });
});

describe("SetAnswer", () => {
  it("is a button for an ask they've answered, or not yet", async () => {
    const politician = { ...examplePolitician, airtableId: null };
    const setStatus = vi.fn<SetStatus>();
    const answered = exampleAsks.find((one) => politician.statuses[one.slug])!;
    const not = exampleAsks.find((one) => !politician.statuses[one.slug])!;
    await render(
      <>
        <SetAnswer politician={politician} ask={answered} setStatus={setStatus} look="primary" />
        <SetAnswer politician={politician} ask={not} setStatus={setStatus} look="ghost" />
      </>,
    );
    expect(page.getByRole("button", { name: copy.setAnswer }).all()).toHaveLength(2);
  });
});
