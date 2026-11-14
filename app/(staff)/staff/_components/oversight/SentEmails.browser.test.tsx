import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import SentEmails from "./SentEmails";
import { exampleSentEmails } from "./SentEmails.examples";
import { oversightCopy } from "@/lib/oversight/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { shellCopy } from "../shell/copy";

const link = (name: string) => page.getByRole("link", { name, exact: true });
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

const NO_SEARCH = { q: "", purpose: [], outcome: [], backend: [], link: [], sort: "", dir: "", page: "" };

describe("SentEmails", () => {
  it("says emails to and from supporters are left out, and offers only the kinds shown, without the permission", async () => {
    const props = { emails: [], total: 0, pages: 1, page: 1, pageSize: 100, search: NO_SEARCH };
    await render(<SentEmails {...props} supporters={false} />);
    await says(oversightCopy.sentEmails.withheld);
  });

  it("sorts by each column but its links, keeping the filters, newest first unless another is chosen", async () => {
    const list = (search: Partial<typeof NO_SEARCH>) => (
      <SentEmails
        emails={exampleSentEmails}
        total={4}
        pages={1}
        page={1}
        pageSize={100}
        search={{ ...NO_SEARCH, ...search }}
      />
    );
    const words = oversightCopy.sentEmails.columns;
    const heading = (name: string) => page.getByRole("link", { name, exact: false });
    const { rerender } = await render(list({ q: "x" }));
    await expect.element(heading(words.when)).toHaveAttribute("href", "/staff/sent-emails?q=x&sort=when&dir=asc");
    await expect.element(heading(words.subject)).toHaveAttribute("href", "/staff/sent-emails?q=x&sort=subject&dir=asc");
    expect(page.getByRole("link", { name: words.links }).query()).toBeNull();
    expect(heading(words.when).element().closest("th")!.getAttribute("aria-sort")).toBe("descending");
    await rerender(list({ sort: "subject", dir: "asc" }));
    await expect.element(heading(words.subject)).toHaveAttribute("href", "/staff/sent-emails?sort=subject&dir=desc");
    expect(heading(words.subject).element().closest("th")!.getAttribute("aria-sort")).toBe("ascending");
  });

  it("has a heading, each person linked if they can be, imported tagged, and links through its letter", async () => {
    await render(
      <SentEmails emails={exampleSentEmails} total={150} pages={2} page={1} pageSize={100} search={NO_SEARCH} />,
    );
    await expect.element(page.getByRole("heading", { level: 1, name: shellCopy.nav.sentEmails })).toBeVisible();
    const words = oversightCopy.sentEmails;
    expect([...document.querySelectorAll("th")].map((th) => th.textContent!.replace(/[ ▲▼]+$/, ""))).toEqual(
      Object.values(words.columns),
    );
    await says(words.backends.postmark);
    await expect.element(link("Jane Smith").first()).toHaveAttribute("href", "/staff/supporters/5");
    expect(document.body.textContent).toContain("Sam Brown");
    expect(page.getByRole("link", { name: "Sam Brown" }).query()).toBeNull();
    await says(words.imported);
    await says(words.outcomes.bounced);
    await expect.element(link(words.mailingLink)).toHaveAttribute("href", "/staff/mailings/3");
    await expect
      .element(link(words.campaignLink).first())
      .toHaveAttribute("href", "/staff/campaigns/support-sobel-bill");
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.next }))
      .toHaveAttribute("href", "/staff/sent-emails?page=2");
  });

  it("cuts a long subject short at a word, with … to unfold the whole of it; one a word or two over is whole", async () => {
    const long = "Please make the Millennium Dome into a giant pause button";
    const nearly = "Request to co-sign letter on frontier AI risks";
    await render(
      <SentEmails
        emails={[
          { ...exampleSentEmails[3], id: 91, subject: long },
          { ...exampleSentEmails[3], id: 92, subject: "Confirm sign in" },
          { ...exampleSentEmails[3], id: 93, subject: nearly },
        ]}
        total={3}
        pages={1}
        page={1}
        pageSize={100}
        search={NO_SEARCH}
      />,
    );
    const whole = page.getByText(long, { exact: true });
    await expect.element(whole).not.toBeVisible();
    await expect.element(page.getByText("Please make the Millennium Dome into a …", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("cell", { name: "Confirm sign in", exact: true })).toBeVisible();
    await expect.element(page.getByRole("cell", { name: nearly, exact: true })).toBeVisible();
    await page.getByText("…", { exact: true }).click();
    await expect.element(whole).toBeVisible();
  });

  it("shows a purpose or outcome it doesn't know as it is, and a blank From", async () => {
    await render(
      <SentEmails
        emails={[
          { ...exampleSentEmails[3], purpose: "new-purpose", outcome: "new-outcome", fromAddress: null, subject: null },
        ]}
        total={1}
        pages={1}
        page={1}
        pageSize={100}
        search={NO_SEARCH}
      />,
    );
    await says("new-purpose");
    await says("new-outcome");
  });
});
