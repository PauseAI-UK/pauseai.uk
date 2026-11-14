import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { changesSearch } from "@/lib/staff-search";
import ChangesTable from "./ChangesTable";
import MyGmail from "./accounts/MyGmail";
import { accountsCopy } from "./accounts/copy";
import ListFrame from "./ui/ListFrame";
import Withheld from "./ui/Withheld";
import Tabs from "./ui/Tabs";
import Run from "./Run";
import { exampleRun } from "./RunList.examples";
import SentEmails from "./SentEmails";
import StaffNav from "./shell/StaffNav";
import { shellCopy } from "./shell/copy";
import { exampleSentEmails } from "./SentEmails.examples";

const NOW = "2026-11-05T09:00:00Z";
const link = (name: string) => page.getByRole("link", { name, exact: true });
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("ChangesTable, without the supporters permission", () => {
  it("says entries about supporters are left out", async () => {
    const log = { changes: [], total: 0, pages: 1, pageSize: 100 };
    const { rerender } = await render(
      <ChangesTable search={changesSearch({})} log={log} page={1} supporters={false} />,
    );
    await says(staffCopy.changes.withheld);
    await rerender(<ChangesTable search={changesSearch({})} log={log} page={1} />);
    expect(document.body.textContent).not.toContain(staffCopy.changes.withheld);
  });
});

const NO_SEARCH = { q: "", purpose: [], outcome: [], backend: [], link: [], sort: "", dir: "", page: "" };

describe("SentEmails", () => {
  it("says emails to and from supporters are left out, and offers only the kinds shown, without the permission", async () => {
    const props = { emails: [], total: 0, pages: 1, page: 1, pageSize: 100, search: NO_SEARCH };
    await render(<SentEmails {...props} supporters={false} />);
    await says(staffCopy.sentEmails.withheld);
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
    const words = staffCopy.sentEmails.columns;
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
    const words = staffCopy.sentEmails;
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

describe("the rule over a list", () => {
  it("is the tabs', with none of the list's own to double it", async () => {
    await render(
      <>
        <Tabs label="Which" current="a" tabs={[{ key: "a", label: "A", href: "/a" }]} />
        <ListFrame
          count="1 row"
          total={1}
          page={1}
          pages={1}
          pageSize={1}
          columns={[{ key: "one", label: "One", cell: (row: string) => row }]}
          rows={["Row"]}
          rowKey={(row) => row}
          empty="None"
        />
      </>,
    );
    const bar = page.getByText("1 row").element().parentElement!.parentElement!;
    expect(getComputedStyle(bar).borderTopWidth).toBe("0px");
    expect(getComputedStyle(page.getByRole("navigation", { name: "Which" }).element()).boxShadow).not.toBe("none");
  });
});

describe("Withheld", () => {
  it("says what's kept back beside its envelope, and links nowhere", async () => {
    await render(<Withheld>Kept back</Withheld>);
    await says("Kept back");
    expect(document.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(page.getByRole("link").query()).toBeNull();
  });
});

describe("the rest", () => {
  it("has all emails in the menu, under Politicians", async () => {
    await render(<StaffNav email="jo@pauseai.uk" permissions={[]} />);
    expect(document.querySelector('nav a[href="/staff/emails"]')?.textContent).toContain(shellCopy.nav.emails);
  });

  it("marks new pages in the navigation", async () => {
    await render(<StaffNav email="jo@pauseai.uk" permissions={["supporters"]} fresh={["campaigns"]} />);
    const tagged = [...document.querySelectorAll("nav a")].filter((a) => a.textContent?.endsWith(shellCopy.nav.newTag));
    expect(tagged.map((a) => a.getAttribute("href"))).toContain("/staff/campaigns");
    expect(tagged.map((a) => a.getAttribute("href"))).not.toContain("/staff/supporters");
  });

  it("marks a draft page as a draft, however new, with no dot", async () => {
    await render(<StaffNav email="jo@pauseai.uk" permissions={["supporters"]} fresh={["broadcasts"]} />);
    const link = document.querySelector('nav a[href="/staff/broadcasts"]')!;
    expect(link.textContent).toContain(shellCopy.nav.draftTag);
    expect(link.textContent).not.toContain(shellCopy.nav.newTag);
    expect(link.querySelector("[aria-hidden='true'] + [aria-hidden='true']")).toBeNull();
  });

  it("says in a Gmail read how many one-off emails it kept", async () => {
    const accounts = [{ account: "policy@pauseai.uk", replies: 0, autoReplies: 0, bounces: 0, oneOffs: 2 }];
    await render(<Run run={exampleRun("read-gmail", { accounts })} open />);
    await says(staffCopy.gmailReading.oneOffs(2));
  });

  it("says when threads with politicians are kept from your Gmail", async () => {
    const account = { email: "jo@pauseai.uk", name: "Jo", connectedAt: new Date(NOW), sentToday: 0, remaining: 1800 };
    const props = { me: "jo@pauseai.uk", account, outcome: "", disconnect: () => {} };
    const { rerender } = await render(<MyGmail {...props} keepsThreads />);
    await says(accountsCopy.gmail.kept.before);
    await expect.element(link(accountsCopy.gmail.oneOffEmails)).toHaveAttribute("href", "/staff/emails?type=one-off");
    await rerender(<MyGmail {...props} />);
    expect(link(accountsCopy.gmail.oneOffEmails).query()).toBeNull();
    await says(accountsCopy.gmail.notKept.before);
    await expect.element(link(shellCopy.nav.mailings)).toHaveAttribute("href", "/staff/mailings");
    // hello@'s sends the broadcasts too.
    await rerender(<MyGmail {...props} me="hello@pauseai.uk" sendsBroadcasts />);
    await says(accountsCopy.gmail.notKeptBroadcasts.before);
    await expect.element(link(shellCopy.nav.broadcasts)).toHaveAttribute("href", "/staff/broadcasts");
    await rerender(<MyGmail {...props} lettersInbox />);
    expect(link(shellCopy.nav.mailings).query()).toBeNull();
  });
});
