import { campaigns } from "@/lib/content/email-your-mp";
import type { CampaignSummary } from "@/lib/server/campaigns";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { changesSearch } from "@/lib/staff-search";
import { staffTime } from "@/lib/staff-time";
import type { Mailing } from "@/lib/server/mailings";
import AnswerWord from "./AnswerWord";
import AskView from "./AskView";
import ChangesTable from "./ChangesTable";
import CampaignLetter from "./CampaignLetter";
import CampaignsOverview, { CampaignAsk, letterRange } from "./CampaignsOverview";
import CampaignView from "./CampaignView";
import {
  exampleAskPage,
  exampleChanged,
  exampleCampaign,
  exampleCampaignEmpty,
  exampleCampaignNoAsk,
  exampleHiddenOneOff,
  exampleOneOffs,
  exampleOneOffThread,
  exampleForwardThread,
  exampleSentEmails,
  exampleVersions,
} from "./CampaignPages.examples";
import LetterThread from "./LetterThread";
import { exampleThread } from "./LetterThread.examples";
import MailEmail from "./MailEmail";
import MailingView from "./MailingView";
import { exampleMailing } from "./MailingsTable.examples";
import PoliticianDetails from "./PoliticianDetails";
import { examplePolitician } from "./PoliticianTable.examples";
import { emptyLettersSearch, exampleLetter } from "./LettersTable.examples";
import MyGmail from "./MyGmail";
import { OneOffTable } from "./OneOffList";
import OneOffThreadView from "./OneOffThreadView";
import ListFrame from "./ui/ListFrame";
import Withheld from "./ui/Withheld";
import Tabs from "./ui/Tabs";
import Run from "./Run";
import { exampleRun } from "./RunList.examples";
import SentEmails from "./SentEmails";
import StaffNav from "./StaffNav";

const copy = staffCopy.campaigns;
const NOW = "2026-11-05T09:00:00Z";
const link = (name: string) => page.getByRole("link", { name, exact: true });
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("CampaignsOverview", () => {
  it("files each under the month of its last letter, the rest under their years, those with none first, saying who it's from and its ask", async () => {
    await render(
      <CampaignsOverview campaigns={[exampleCampaign, exampleCampaignNoAsk, exampleCampaignEmpty]} now={NOW} />,
    );
    // What needs a look, leading to its letters, and the rest folded behind how many are fine.
    expect(document.querySelector(`a[href="/staff/campaigns/${exampleCampaign.slug}?tab=unreached"]`)).not.toBeNull();
    expect(document.body.textContent).toContain(staffCopy.copyStates.andFine(11));
    expect(document.body.textContent).toContain(staffCopy.copyStates.allFine(12));
    // How many went, after a dot: all but the one that bounced; or none.
    expect(document.body.textContent).toContain(copy.sent(11));
    expect(document.body.textContent).toContain(copy.sent(0));
    const headings = page
      .getByRole("heading", { level: 2 })
      .all()
      .map((h) => h.element().textContent);
    expect(headings).toEqual(["October 2026", "2025"]);
    await expect
      .element(link(exampleCampaign.title))
      .toHaveAttribute("href", `/staff/campaigns/${exampleCampaign.slug}`);
    await expect.element(link(exampleCampaign.askTitle!)).toHaveAttribute("href", `/staff/asks/${exampleCampaign.ask}`);
    expect(document.body.textContent).toContain(`${copy.fromSupporters} · ${copy.lettersTo(12, 9)}`);
    expect(document.body.textContent).toContain("18 Jun – 22 Oct");
    expect(document.body.textContent).toContain("20 May – 17 Jun 2025");
    // Those with no letters come first, under no month.
    expect(document.querySelector("li")!.textContent).toContain(copy.noLetters);
    expect(document.body.textContent).toContain(staffCopy.asks.noAsk);
  });

  it("says there are none", async () => {
    await render(<CampaignsOverview campaigns={[]} now={NOW} />);
    await says(copy.none);
  });

  it("gives letters' days as a range, a year only once, and one day alone", () => {
    expect(letterRange(new Date("2026-11-01T09:00:00Z"), new Date("2026-11-05T09:00:00Z"), "2026")).toBe(
      "1 Nov – 5 Nov",
    );
    expect(letterRange(new Date("2026-11-05T09:00:00Z"), new Date("2026-11-05T10:00:00Z"), "2026")).toBe("5 Nov");
    expect(letterRange(new Date("2025-07-23T09:00:00Z"), new Date("2025-09-30T09:00:00Z"), "2026")).toBe(
      "23 Jul – 30 Sept 2025",
    );
    expect(letterRange(new Date("2025-12-01T09:00:00Z"), new Date("2026-01-05T09:00:00Z"), "2026")).toBe(
      "1 Dec 2025 – 5 Jan",
    );
    expect(letterRange(new Date("2025-07-23T09:00:00Z"), new Date("2025-07-23T09:00:00Z"), "2026")).toBe("23 Jul 2025");
  });

  it("says an ask by its kind", async () => {
    const { rerender } = await render(<CampaignAsk campaign={exampleCampaign} />);
    expect(document.body.textContent).toContain(staffCopy.asks.askTo.letter);
    await rerender(<CampaignAsk campaign={{ ...exampleCampaign, askKind: "event" }} />);
    expect(document.body.textContent).toContain(staffCopy.asks.askTo.event);
  });
});

describe("CampaignLetter", () => {
  it("leads to those who changed the wording, when anyone did", async () => {
    const { rerender } = await render(<CampaignLetter changedHref="/changed" versions={exampleVersions} changed={3} />);
    await expect
      .element(page.getByRole("link", { name: staffCopy.campaigns.changedLink(3) }))
      .toHaveAttribute("href", "/changed");
    await rerender(<CampaignLetter changedHref="/changed" versions={exampleVersions} changed={0} />);
    expect(page.getByRole("link").query()).toBeNull();
  });

  it("chooses among versions, each with its subject and text, names as chips", async () => {
    await render(<CampaignLetter changedHref="/changed" versions={exampleVersions} changed={exampleChanged} />);
    await says(exampleVersions[0].subject);
    await says(copy.fields.salutation);
    await page.getByRole("combobox").selectOptions("older");
    await says(exampleVersions[1].subject);
  });

  it("with one version, says how many it has, and with no one changing the wording, no link", async () => {
    await render(<CampaignLetter changedHref="/changed" versions={exampleVersions.slice(1)} changed={0} />);
    expect(page.getByRole("combobox").query()).toBeNull();
    expect(document.body.textContent).toContain(copy.versionLine("18 Jun 2026", 8));
    const { rerender } = await render(
      <CampaignLetter
        changedHref="/changed"
        versions={[{ ...exampleVersions[0], from: null }]}
        changed={exampleChanged}
      />,
    );
    expect(document.body.textContent).toContain(copy.versionLine(null, 4));
    await rerender(<CampaignLetter changedHref="/changed" versions={[]} changed={exampleChanged} />);
    await says(copy.noText);
  });
});

describe("CampaignView's public page", () => {
  const view = (campaign: CampaignSummary) => (
    <CampaignView
      campaign={campaign}
      versions={exampleVersions}
      changed={0}
      letters={{ letters: [], total: 0, pages: 1, pageSize: 100 }}
      search={emptyLettersSearch}
    />
  );

  it("leads to the campaign on the site, else where its letter is kept, else says there's none", async () => {
    const see = () => page.getByRole("link", { name: staffCopy.campaigns.seePublicPage });
    const code = campaigns[0];
    const { rerender } = await render(view({ ...exampleCampaign, slug: code.slug }));
    await expect.element(see()).toHaveAttribute("href", `/campaigns/${code.slug}`);
    await rerender(view({ ...exampleCampaign, slug: "gone", url: "https://example.org/letter.pdf" }));
    await expect.element(see()).toHaveAttribute("href", "https://example.org/letter.pdf");
    await rerender(view({ ...exampleCampaign, slug: "gone", url: null }));
    expect(see().query()).toBeNull();
  });
});

describe("CampaignView", () => {
  const letters = [
    exampleLetter,
    { ...exampleLetter, id: 2, status: "sent", answer: "signed" as const, constituency: null, party: "" },
    { ...exampleLetter, id: 3, status: "sent", repliedAt: new Date(NOW), ownWords: null, supporterId: null },
    { ...exampleLetter, id: 4, status: "sent", autoRepliedAt: new Date(NOW) },
    { ...exampleLetter, id: 5, status: "not_sent", backend: "postmark" as const },
    { ...exampleLetter, id: 6, status: "not_sent", backend: "airtable" as const },
  ];
  const view = (campaign = exampleCampaign, search = emptyLettersSearch) => (
    <CampaignView
      campaign={campaign}
      versions={exampleVersions}
      changed={exampleChanged}
      letters={{ letters, total: 150, pages: 2, pageSize: 100 }}
      search={search}
    />
  );

  it("says who it's from and to, its ask and how many answered, with its letters", async () => {
    await render(view());
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent(exampleCampaign.title);
    await says(copy.supporters(10));
    await says(copy.politicians(9));
    await says(staffCopy.mailingPages.answeredBar(3, 9));
    await expect.element(link(exampleCampaign.askTitle!)).toHaveAttribute("href", `/staff/asks/${exampleCampaign.ask}`);
    await says(staffCopy.statuses.signed);
    // Each letter's one tag: answered in place of sent; what refused one, where that's known.
    const tags = staffCopy.copyStates.tags;
    await says(tags["unreached:bounced"]!);
    await says(tags.answered!);
    await says(tags.replied!);
    await says(tags["error:postmark"]!);
    await expect.element(page.getByText(tags.error!, { exact: true })).toBeVisible();
    await says(staffCopy.letters.status.auto_reply);
    // The counts in two groups, each under its total.
    await expect.element(page.getByRole("group", { name: `11 ${staffCopy.copyStates.groups.went}` })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `1 ${staffCopy.copyStates.counts.unreached}` }))
      .toHaveAttribute("href", `/staff/campaigns/${exampleCampaign.slug}?tab=unreached`);
    await expect
      .element(page.getByRole("link", { name: copy.changedLink(exampleChanged) }))
      .toHaveAttribute("href", `/staff/campaigns/${exampleCampaign.slug}?tab=changed`);
    await expect
      .element(page.getByRole("link", { name: staffCopy.paging.next }))
      .toHaveAttribute("href", `/staff/campaigns/${exampleCampaign.slug}?page=2`);
  });

  it("with no ask, says so, with no bar and no answers", async () => {
    const { unmount } = await render(view(exampleCampaignNoAsk));
    expect(document.body.textContent).toContain(staffCopy.asks.noAsk);
    expect(document.querySelector("progress")).toBeNull();
    await expect.element(page.getByText(staffCopy.copyStates.counts.answered!)).not.toBeInTheDocument();
    await unmount();
    // A count chosen heads the letters, and pressed again shows them all; so does the changed wording.
    const { unmount: again } = await render(
      view(exampleCampaignNoAsk, { ...emptyLettersSearch, tab: "replied", page: "2" }),
    );
    await expect.element(page.getByRole("heading", { name: staffCopy.copyStates.tabs.replied })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `2 ${staffCopy.copyStates.counts.replied}` }))
      .toHaveAttribute("title", copy.showAll);
    await expect.element(page.getByRole("link", { name: staffCopy.paging.previous })).toBeVisible();
    await again();
    await render(view(exampleCampaignEmpty, { ...emptyLettersSearch, tab: "changed" }));
    await expect.element(page.getByRole("heading", { name: copy.tabs.changed })).toBeVisible();
  });
});

describe("AnswerWord", () => {
  const mark = (name: string) => getComputedStyle(page.getByText(name).element(), "::before").content;

  it("ticks a yes, crosses a no, and marks nothing else", async () => {
    await render(
      <>
        <AnswerWord status="signed" />
        <AnswerWord status="going" />
        <AnswerWord status="declined" />
        <AnswerWord status="other" />
        <AnswerWord status={null} />
      </>,
    );
    expect(mark(staffCopy.statuses.signed)).toContain("✓");
    expect(mark(staffCopy.statuses.going)).toContain("✓");
    expect(mark(staffCopy.statuses.declined)).toContain("✕");
    expect(mark(staffCopy.statuses.other)).toBe("none");
    expect(mark(staffCopy.statuses.noAnswer)).toBe("none");
  });
});

describe("AskView", () => {
  const path = `/staff/asks/${exampleAskPage.slug}`;
  const words = staffCopy.asks.page;

  it("leads with what they were asked, then its answers, then how we asked and its counts", async () => {
    await render(<AskView ask={exampleAskPage} answer="" />);
    expect(document.body.textContent).toContain(staffCopy.politician.askedThem("PauseAI", "letter").slice(0, 8));
    await expect.element(link(exampleAskPage.ways[0].title)).toHaveAttribute("href", exampleAskPage.ways[0].href);
    // Each kind under its own heading, with how many letters each sent.
    await says(staffCopy.asks.waysOf.campaign);
    await says(staffCopy.asks.waysOf.mailing);
    expect(document.body.textContent).toContain(`${exampleAskPage.ways[0].title}${words.letters(19)}`);
    await expect.element(link(staffCopy.asks.edit)).toHaveAttribute("href", `${path}/edit`);
    await says(`5 ${words.replied}`);
    await says(`40 ${words.lettersWord(40)}`);
    await expect.element(link("Polly Placeholder")).toHaveAttribute("href", "/staff/politicians/1");
  });

  it("gives a letter the months of its letters, or with none the month typed, and an event its day", async () => {
    const { rerender } = await render(<AskView ask={exampleAskPage} answer="" />);
    await expect
      .element(link(words.everyone))
      .toHaveAttribute("href", `/staff/politicians?ask=${exampleAskPage.slug}&status=any`);
    await says(words.when);
    await says("Jun–Nov 2026");
    await rerender(
      <AskView ask={{ ...exampleAskPage, date: "2026-06-01", firstLetter: null, lastLetter: null }} answer="" />,
    );
    await says("Jun 2026");
    await rerender(<AskView ask={{ ...exampleAskPage, kind: "event", date: "2026-11-01" }} answer="" />);
    await says(words.on);
    await says("1 Nov 2026");
  });

  it("gives each answer a column, its count leading to all who gave it", async () => {
    const column = (name: string) => page.getByRole("link", { name, exact: true });
    const { rerender } = await render(<AskView ask={exampleAskPage} answer="" />);
    await expect.element(column(`${staffCopy.statuses.signed} 2`)).toHaveAttribute("href", `${path}?answer=signed`);
    await expect.element(column(`${staffCopy.statuses.noAnswer} 37`)).toHaveAttribute("href", `${path}?answer=none`);
    // More than it shows: a link to the rest. All shown: none.
    await expect.element(link(words.allOf(37))).toHaveAttribute("href", `${path}?answer=none`);
    await expect.element(link(words.allOf(2))).toHaveAttribute("href", `${path}?answer=signed`);
    expect(link(words.allOf(1)).query()).toBeNull();
    // Nobody in a yes or no column is tagged: the column's name says their answer.
    expect(page.getByText(staffCopy.statuses.signed, { exact: true }).all()).toHaveLength(1);
    await rerender(
      <AskView
        ask={{
          ...exampleAskPage,
          kind: "event",
          counts: { other: 2, declined: 1 },
          noAnswer: 0,
          groups: [
            { key: "going", total: 0, people: [] },
            {
              key: "other",
              total: 2,
              people: [
                { ...exampleAskPage.groups[0].people[0], status: "other", note: "Tentatively said yes" },
                { ...exampleAskPage.groups[2].people[0], status: "other", note: "" },
              ],
            },
            { key: "declined", total: 1, people: exampleAskPage.groups[1].people },
          ],
        }}
        answer=""
      />,
    );
    // Other answers, each tagged with what it was, and none for one with no note.
    await says(`${words.otherAnswers} 2`);
    await says("Tentatively said yes");
    expect(page.getByText(staffCopy.statuses.other, { exact: true }).query()).toBeNull();
    // Nobody gave it: no link, and it says so.
    await says(`${staffCopy.statuses.going} 0`);
    expect(column(`${staffCopy.statuses.going} 0`).query()).toBeNull();
    await says(words.none);
  });

  it("shows those who gave an answer chosen, under the columns' tops, and pressed again, the columns", async () => {
    const pill = (name: string, n: number) => page.getByRole("link", { name: `${name} ${n}`, exact: true });
    const signed = () => pill(staffCopy.statuses.signed, 2);
    const none = () => pill(staffCopy.statuses.noAnswer, 37);
    const { rerender } = await render(<AskView ask={exampleAskPage} answer="signed" />);
    await expect.element(signed()).toHaveAttribute("href", path);
    await expect.element(signed()).toHaveAttribute("aria-current", "true");
    await expect.element(signed()).toHaveAttribute("title", words.showAll);
    await expect.element(none()).toHaveAttribute("href", `${path}?answer=none`);
    await expect.element(none()).not.toHaveAttribute("aria-current");
    await says(words.lastWrittenTo);
    await says(staffCopy.statuses.declined);
    await says("1 Oct 2026");
    await expect
      .element(link(words.everyone))
      .toHaveAttribute("href", `/staff/politicians?ask=${exampleAskPage.slug}&status=any`);
    // Those with no answer, and an answer nobody gave isn't a link.
    await rerender(
      <AskView
        ask={{
          ...exampleAskPage,
          answers: [{ ...exampleAskPage.answers[0], status: null }],
          groups: [{ ...exampleAskPage.groups[0], total: 0 }, exampleAskPage.groups[2]],
        }}
        answer="none"
      />,
    );
    await expect.element(none()).toHaveAttribute("aria-current", "true");
    await says(staffCopy.statuses.noAnswer);
    expect(signed().query()).toBeNull();
    // Other answers say what each was, or "other" for one with no note.
    await rerender(
      <AskView
        ask={{
          ...exampleAskPage,
          answers: [
            { ...exampleAskPage.answers[0], status: "other", note: "Responded after event" },
            { ...exampleAskPage.answers[1], status: "other", note: "" },
          ],
        }}
        answer="other"
      />,
    );
    await says("Responded after event");
    await says(staffCopy.statuses.other);
  });

  it("pages through the answers, keeping the answer chosen", async () => {
    await render(<AskView ask={{ ...exampleAskPage, answersTotal: 150, pages: 2 }} answer="signed" />);
    await says(staffCopy.campaigns.politicians(150));
    await expect
      .element(page.getByRole("link", { name: staffCopy.paging.next }))
      .toHaveAttribute("href", `${path}?answer=signed&page=2`);
  });

  it("an event: Edit, a link on our site or another's, and when there's nothing", async () => {
    const { rerender } = await render(<AskView ask={{ ...exampleAskPage, kind: "event", url: "/events" }} answer="" />);
    await expect.element(link(staffCopy.asks.edit)).toHaveAttribute("href", `${path}/edit`);
    await expect.element(link(words.theLink.event)).toHaveAttribute("href", "/events");
    await rerender(
      <AskView
        ask={{
          ...exampleAskPage,
          url: "https://example.org/letter",
          counts: {},
          noAnswer: 0,
          ways: [],
          groups: [],
          answers: [],
          writtenTo: 0,
        }}
        answer=""
      />,
    );
    await expect.element(link(words.theLink.letter)).toHaveAttribute("target", "_blank");
    await says(words.noWay);
    await says(words.none);
    // Nobody has answered, but some were written to: their column still shows.
    await rerender(<AskView ask={{ ...exampleAskPage, counts: {} }} answer="" />);
    await expect.element(link(`${staffCopy.statuses.noAnswer} 37`)).toBeVisible();
  });
});

describe("ChangesTable, without the supporters permission", () => {
  it("says entries about supporters are left out", async () => {
    const log = { changes: [], total: 0, pages: 1, pageSize: 100 };
    const { rerender } = await render(
      <ChangesTable search={changesSearch({})} log={log} page={1} airtableTable="x" supporters={false} />,
    );
    await says(staffCopy.changes.withheld);
    await rerender(<ChangesTable search={changesSearch({})} log={log} page={1} airtableTable="x" />);
    expect(document.body.textContent).not.toContain(staffCopy.changes.withheld);
  });
});

describe("the one-off emails", () => {
  it("on a person's page, lists each thread, whose it is and when, and hides what staff can't read", async () => {
    await render(
      <OneOffTable
        threads={[...exampleOneOffs, exampleHiddenOneOff, { ...exampleOneOffs[0], id: 3, subject: "", people: [] }]}
      />,
    );
    await says(staffTime(exampleOneOffs[0].latestAt));
    await says(exampleOneOffs[0].mailboxes!.join(", "));
    await says(exampleOneOffs[0].participants!.join(", "));
    const answers = [...document.querySelectorAll("tbody tr")].map((row) => row.querySelectorAll("td")[3].textContent);
    expect(answers.slice(0, 3)).toEqual([staffCopy.oneOff.answers.yes, staffCopy.oneOff.answers.no, "–"]);
    await expect.element(link(exampleOneOffs[0].subject!)).toHaveAttribute("href", "/staff/one-off/1");
    await says(staffCopy.oneOff.noPolitician);
    await says(staffCopy.oneOff.hidden);
    expect(link(staffCopy.oneOff.hidden).query()).toBeNull();
    await expect.element(link(staffCopy.oneOff.noSubject)).toBeVisible();
  });

  it("on a person's page, shows nothing with none", async () => {
    const { rerender } = await render(<OneOffTable threads={[]} />);
    expect(page.getByRole("heading").query()).toBeNull();
    await rerender(<OneOffTable threads={exampleOneOffs} />);
    await expect.element(page.getByRole("heading", { name: staffCopy.oneOff.onPageTitle })).toBeVisible();
  });

  it("opens a thread's messages, and says when it can't", async () => {
    const { rerender } = await render(<OneOffThreadView thread={exampleOneOffThread} />);
    const title = page.getByRole("heading", { level: 1 });
    const facts = () => page.getByRole("banner").element().querySelector("p")!.textContent;
    await expect.element(title).toHaveTextContent("Thread between Joseph Example and Polly Placeholder");
    expect(facts()).toBe(
      [
        staffCopy.oneOff.fact(staffCopy.oneOff.columns.subject, exampleOneOffThread.subject!),
        staffCopy.oneOff.fact(staffCopy.oneOff.columns.mailbox, exampleOneOffThread.mailboxes!.join(", ")),
        staffCopy.oneOff.fact(staffCopy.oneOff.columns.messages, exampleOneOffThread.messages),
        staffCopy.oneOff.fact(staffCopy.oneOff.columns.when, staffTime(exampleOneOffThread.latestAt)),
      ].join(" · "),
    );
    await says("Could we meet?");
    await says(staffCopy.oneOff.unreadable);
    // The out-of-office shows its first paragraph, the rest and its quote in one fold.
    await says("I'm away until Monday.");
    await expect.element(page.getByText("may be confidential", { exact: false })).not.toBeVisible();
    expect(page.getByText(staffCopy.letterThread.quoted).query()).toBeNull();
    await page.getByText(staffCopy.letterThread.autoInFull).click();
    await expect.element(page.getByText("> Could we meet?", { exact: false })).toBeVisible();
    for (const name of ["Placeholder, Polly", "polly.placeholder.mp@parliament.uk"]) {
      await expect.element(link(name)).toHaveAttribute("href", "/staff/politicians/1");
    }
    await says("Jane Smith <jane.smith@example.com>");
    await says("someone@example.com");
    expect(link("Joseph Example").query()).toBeNull();
    await rerender(<OneOffThreadView thread={{ ...exampleHiddenOneOff, messages_: null }} />);
    await says(staffCopy.oneOff.hidden);
    // One that's hidden says neither who wrote in it nor its subject.
    await expect.element(title).toHaveTextContent(staffCopy.oneOff.title);
    expect(facts()).not.toContain(staffCopy.oneOff.columns.subject);
    expect(facts()).not.toContain(staffCopy.oneOff.columns.mailbox);
    await rerender(
      <OneOffThreadView
        thread={{
          ...exampleOneOffThread,
          subject: "",
        }}
      />,
    );
    expect(facts()).toContain(staffCopy.oneOff.fact(staffCopy.oneOff.columns.subject, staffCopy.oneOff.noSubject));
    // Only one person wrote in it: the thread is with them.
    await rerender(<OneOffThreadView thread={{ ...exampleOneOffThread, participants: ["Jane Smith"] }} />);
    await expect.element(title).toHaveTextContent("Thread with Jane Smith");
    await rerender(<OneOffThreadView thread={{ ...exampleOneOffThread, people: [] }} />);
    await says(staffCopy.oneOff.people.none);
  });

  it("rebuilds a forward's messages before it, oldest first, beside the politicians it's linked to", async () => {
    await render(<OneOffThreadView thread={exampleForwardThread} />);
    const emails = page.getByRole("article").all();
    expect(emails.map((email) => email.element().getAttribute("aria-label"))).toEqual([
      "Can we meet?",
      "Re: Can we meet?",
      "Fwd: my MP's answer",
    ]);
    const text = emails.map((email) => email.element().textContent);
    expect(text[0]).toContain("15 Oct 2026, at 11:17");
    // One rebuilt from an "On … wrote:" line says nothing of whom it was to, so it has no To.
    const heads = (i: number) => [...emails[i].element().querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(heads(0)).not.toContain(staffCopy.letterThread.headers.to);
    expect(heads(1)).toContain(staffCopy.letterThread.headers.to);
    expect(text[1]).toContain(staffCopy.oneOff.rebuilt("Jane Smith"));
    expect(text[2]).toContain(staffCopy.oneOff.forwardedAlone);
    await expect.element(link("pollyplaceholdermp@parliament.uk")).not.toBeInTheDocument();
    await expect.element(link("Polly Placeholder MP")).toHaveAttribute("href", "/staff/politicians/1");
    const people = page.getByRole("region", { name: staffCopy.oneOff.people.title });
    await expect
      .element(people.getByRole("link", { name: "Polly Placeholder" }))
      .toHaveAttribute("href", "/staff/politicians/1");
  });

  it("shows a forward's note over what it carries, and a carried message copied to someone", async () => {
    const [message] = exampleForwardThread.messages_!;
    const [first, second] = message.forwarded;
    await render(
      <OneOffThreadView
        thread={{
          ...exampleForwardThread,
          messages_: [
            {
              ...message,
              fromName: "",
              text: "See below.",
              forwarded: [{ ...first, cc: "jo@example.com" }, second],
            },
          ],
        }}
      />,
    );
    await says("See below.");
    await says("jo@example.com");
    await expect.element(page.getByText(staffCopy.oneOff.rebuilt(message.fromAddress)).first()).toBeVisible();
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
    await expect.element(page.getByRole("heading", { level: 1, name: staffCopy.nav.sentEmails })).toBeVisible();
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
      .element(page.getByRole("link", { name: staffCopy.paging.next }))
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

describe("an imported mailing's text", () => {
  const doc = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "field", attrs: { field: "own" } }] }],
  };
  const imported = (props: Partial<Mailing>) => (
    <MailingView mailing={{ ...exampleMailing, ...props }} asks={[]} stop={() => {}} reschedule={() => {}} />
  );

  it("shows its template, with its fields as chips, saying so if it's approximate", async () => {
    const { rerender } = await render(
      imported({
        importedText: doc,
        importedSubject: "The subject",
        sentFrom: "joseph@pauseai.info",
        askKind: null,
        ask: null,
      }),
    );
    await says("The subject");
    await says(staffCopy.mailings.importedFields.own);
    expect(document.body.textContent).not.toContain(staffCopy.letterThread.approximate);
    await rerender(imported({ importedText: doc, sentFrom: null, importedTextApproximate: true, askKind: "letter" }));
    await says(staffCopy.letterThread.approximate);
    await says(staffCopy.mailings.notRecorded);
    await says(staffCopy.asks.askTo.letter);
  });

  it("says a letter's text is approximate on its page", async () => {
    await render(<LetterThread thread={{ ...exampleThread, approximate: true }} />);
    await says(staffCopy.letterThread.approximate);
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

describe("MailEmail", () => {
  it("shows who it's from and to where it's said, always its subject, then its body", async () => {
    const { rerender } = await render(
      <MailEmail from="jo@pauseai.uk" to="Each politician" subject="A subject">
        The letter
      </MailEmail>,
    );
    const terms = () => [...document.querySelectorAll("dt")].map((dt) => dt.textContent);
    const words = staffCopy.mailingPages;
    expect(terms()).toEqual([words.from, words.to, words.subject]);
    await says("The letter");
    await rerender(<MailEmail subject="A subject">The letter</MailEmail>);
    expect(terms()).toEqual([words.subject]);
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
  it("lists a politician's one-off emails in their correspondence, one they can't read said so", async () => {
    await render(
      <PoliticianDetails
        politician={examplePolitician}
        asks={[]}
        setStatus={() => {}}
        block={undefined}
        unblock={() => {}}
        letters={{ senders: false, letters: [] }}
        oneOffs={[exampleOneOffs[0], exampleHiddenOneOff, { ...exampleOneOffs[0], id: 3, subject: "" }]}
        history={[]}
        airtableTable="x"
      />,
    );
    await expect.element(link(exampleOneOffs[0].subject!)).toHaveAttribute("href", "/staff/one-off/1");
    await expect.element(link(staffCopy.oneOff.noSubject)).toHaveAttribute("href", "/staff/one-off/3");
    await expect
      .element(
        page
          .getByRole("region", { name: staffCopy.politician.correspondence.title })
          .getByText(staffCopy.oneOff.hidden),
      )
      .toBeVisible();
    expect(link(staffCopy.oneOff.hidden).query()).toBeNull();
  });

  it("has all emails in the menu, under Politicians", async () => {
    await render(<StaffNav email="jo@pauseai.uk" permissions={[]} />);
    expect(document.querySelector('nav a[href="/staff/emails"]')?.textContent).toContain(staffCopy.nav.emails);
  });

  it("marks new pages in the navigation", async () => {
    await render(<StaffNav email="jo@pauseai.uk" permissions={["supporters"]} fresh={["campaigns"]} />);
    const tagged = [...document.querySelectorAll("nav a")].filter((a) => a.textContent?.endsWith(staffCopy.nav.newTag));
    expect(tagged.map((a) => a.getAttribute("href"))).toContain("/staff/campaigns");
    expect(tagged.map((a) => a.getAttribute("href"))).not.toContain("/staff/supporters");
  });

  it("marks a draft page as a draft, however new, with no dot", async () => {
    await render(<StaffNav email="jo@pauseai.uk" permissions={["supporters"]} fresh={["broadcasts"]} />);
    const link = document.querySelector('nav a[href="/staff/broadcasts"]')!;
    expect(link.textContent).toContain(staffCopy.nav.draftTag);
    expect(link.textContent).not.toContain(staffCopy.nav.newTag);
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
    await says(staffCopy.oneOff.kept.before);
    await expect.element(link(staffCopy.oneOff.title)).toHaveAttribute("href", "/staff/emails?type=one-off");
    await rerender(<MyGmail {...props} />);
    expect(link(staffCopy.oneOff.title).query()).toBeNull();
    await says(staffCopy.oneOff.notKept.before);
    await expect.element(link(staffCopy.mailings.title)).toHaveAttribute("href", "/staff/mailings");
    // hello@'s sends the broadcasts too.
    await rerender(<MyGmail {...props} me="hello@pauseai.uk" />);
    await says(staffCopy.oneOff.notKeptBroadcasts.before);
    await expect.element(link(staffCopy.broadcastPages.title)).toHaveAttribute("href", "/staff/broadcasts");
    await rerender(<MyGmail {...props} lettersInbox />);
    expect(link(staffCopy.mailings.title).query()).toBeNull();
  });
});
