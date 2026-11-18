import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { asksCopy } from "@/lib/asks/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import AskView from "./AskView";
import { exampleAskPage } from "./AsksList.examples";

const link = (name: string) => page.getByRole("link", { name, exact: true });
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("AskView", () => {
  const path = `/staff/asks/${exampleAskPage.slug}`;
  const words = asksCopy.asks.page;

  it("sizes its kind's picture as its title's words, at whatever size they are", async () => {
    // Words larger than the page's own: the title, a heading of 2em, grows with them, and its picture with it.
    await render(
      <div style={{ fontSize: "24px" }}>
        <AskView ask={exampleAskPage} answer="" />
      </div>,
    );
    const title = page.getByRole("heading", { level: 1 }).element();
    const picture = title.querySelector("svg")!;
    expect(picture.getBoundingClientRect().height).toBeCloseTo(parseFloat(getComputedStyle(title).fontSize));
    expect(parseFloat(getComputedStyle(title).fontSize)).toBe(48);
  });

  it("leads with what they were asked, then its answers, then how we asked and its counts", async () => {
    await render(<AskView ask={exampleAskPage} answer="" />);
    expect(document.body.textContent).toContain(asksCopy.asks.askedThem("PauseAI", "letter").slice(0, 8));
    await expect.element(link(exampleAskPage.ways[0].title)).toHaveAttribute("href", exampleAskPage.ways[0].href);
    // Each kind under its own heading, with how many letters each sent.
    await says(asksCopy.asks.waysOf.campaign);
    await says(asksCopy.asks.waysOf.mailing);
    expect(document.body.textContent).toContain(`${exampleAskPage.ways[0].title}${words.letters(19)}`);
    await expect.element(link(asksCopy.asks.edit)).toHaveAttribute("href", `${path}/edit`);
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
    await expect
      .element(column(`${staffVocabulary.statuses.signed} 2`))
      .toHaveAttribute("href", `${path}?answer=signed`);
    // Those asked who haven't answered, in the words of its kind, a letter.
    await expect
      .element(column(`${staffVocabulary.invited.letter} 37`))
      .toHaveAttribute("href", `${path}?answer=invited`);
    // More than it shows: a link to the rest. All shown: none.
    await expect.element(link(words.allOf(37))).toHaveAttribute("href", `${path}?answer=invited`);
    // And the way to them on the politicians list, beside the way to those who answered.
    await expect
      .element(link(words.invited))
      .toHaveAttribute("href", `/staff/politicians?ask=${exampleAskPage.slug}&answer=invited&status=any`);
    await expect.element(link(words.allOf(2))).toHaveAttribute("href", `${path}?answer=signed`);
    expect(link(words.allOf(1)).query()).toBeNull();
    // Nobody in a yes or no column is tagged: the column's name says their answer.
    expect(page.getByText(staffVocabulary.statuses.signed, { exact: true }).all()).toHaveLength(1);
    await rerender(
      <AskView
        ask={{
          ...exampleAskPage,
          kind: "event",
          counts: { other: 2, declined: 1 },
          invited: 0,
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
    expect(page.getByText(staffVocabulary.statuses.other, { exact: true }).query()).toBeNull();
    // Nobody gave it: no link, and it says so.
    await says(`${staffVocabulary.statuses.going} 0`);
    expect(column(`${staffVocabulary.statuses.going} 0`).query()).toBeNull();
    await says(words.none);
    // With no one invited, no way to them on the politicians list.
    expect(link(words.invited).query()).toBeNull();
  });

  it("shows those who gave an answer chosen, under the columns' tops, and pressed again, the columns", async () => {
    const pill = (name: string, n: number) => page.getByRole("link", { name: `${name} ${n}`, exact: true });
    const signed = () => pill(staffVocabulary.statuses.signed, 2);
    const invited = () => pill(staffVocabulary.invited.letter, 37);
    const { rerender } = await render(<AskView ask={exampleAskPage} answer="signed" />);
    await expect.element(signed()).toHaveAttribute("href", path);
    await expect.element(signed()).toHaveAttribute("aria-current", "true");
    await expect.element(signed()).toHaveAttribute("title", words.showAll);
    await expect.element(invited()).toHaveAttribute("href", `${path}?answer=invited`);
    await expect.element(invited()).not.toHaveAttribute("aria-current");
    await says(words.lastWrittenTo);
    await says(staffVocabulary.statuses.declined);
    await says("1 Oct 2026");
    await expect
      .element(link(words.everyone))
      .toHaveAttribute("href", `/staff/politicians?ask=${exampleAskPage.slug}&status=any`);
    // Those invited, each said to be so, and an answer nobody gave isn't a link.
    await rerender(
      <AskView
        ask={{
          ...exampleAskPage,
          answers: [{ ...exampleAskPage.answers[0], status: "invited" }],
          groups: [{ ...exampleAskPage.groups[0], total: 0 }, exampleAskPage.groups[2]],
        }}
        answer="invited"
      />,
    );
    await expect.element(invited()).toHaveAttribute("aria-current", "true");
    expect(page.getByRole("row").filter({ hasText: exampleAskPage.answers[0].name }).element().textContent).toContain(
      staffVocabulary.invited.letter,
    );
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
    await says(staffVocabulary.statuses.other);
  });

  it("pages through the answers, keeping the answer chosen", async () => {
    await render(<AskView ask={{ ...exampleAskPage, answersTotal: 150, pages: 2 }} answer="signed" />);
    await says(staffVocabulary.politicians(150));
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.next }))
      .toHaveAttribute("href", `${path}?answer=signed&page=2`);
  });

  it("an event: Edit, a link on our site or another's, and when there's nothing", async () => {
    const { rerender } = await render(<AskView ask={{ ...exampleAskPage, kind: "event", url: "/events" }} answer="" />);
    await expect.element(link(asksCopy.asks.edit)).toHaveAttribute("href", `${path}/edit`);
    await expect.element(link(words.theLink.event)).toHaveAttribute("href", "/events");
    await rerender(
      <AskView
        ask={{
          ...exampleAskPage,
          url: "https://example.org/letter",
          counts: {},
          invited: 0,
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
    // Nobody has answered, but some were asked: their column still shows, and for an event says they're invited.
    await rerender(<AskView ask={{ ...exampleAskPage, counts: {} }} answer="" />);
    await expect.element(link(`${staffVocabulary.invited.letter} 37`)).toBeVisible();
    await rerender(<AskView ask={{ ...exampleAskPage, kind: "event", counts: {} }} answer="" />);
    await expect.element(link(`${staffVocabulary.invited.event} 37`)).toBeVisible();
  });
});
