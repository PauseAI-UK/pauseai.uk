import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { exampleProblems } from "./EmailBlocksTable.examples";
import EmailProblemsTable from "./EmailProblemsTable";

describe("EmailProblemsTable", () => {
  it("lists bounces and complaints, and what each email was", async () => {
    await render(<EmailProblemsTable problems={exampleProblems} letterLinks />);
    const [hard, soft, complaint] = exampleProblems.map((p) => page.getByRole("row").filter({ hasText: p.address }));
    await expect
      .element(hard.getByRole("link", { name: `${staffCopy.emails.letterTo} Bouncy McTestface MP` }))
      .toHaveAttribute("href", "/staff/letters/17");
    await expect.element(soft.getByText(staffCopy.emails.kinds.soft)).toBeVisible();
    await expect.element(soft.getByText(staffCopy.emails.purposes["forwarded-reply"])).toBeVisible();
    await expect.element(complaint.getByText(staffCopy.emails.kinds.complaint)).toBeVisible();
    await expect.element(complaint.getByText(staffCopy.emails.notRecorded)).toBeVisible();
  });

  it("names a letter without linking to it, without letter links", async () => {
    await render(<EmailProblemsTable problems={exampleProblems} letterLinks={false} />);
    await expect.element(page.getByText(`${staffCopy.emails.letterTo} Bouncy McTestface MP`)).toBeVisible();
    expect(document.querySelector('a[href^="/staff/letters"]')).toBeNull();
  });

  it("says when there are none", async () => {
    await render(<EmailProblemsTable problems={[]} letterLinks />);
    await expect.element(page.getByText(staffCopy.emails.noProblems)).toBeVisible();
  });
});
