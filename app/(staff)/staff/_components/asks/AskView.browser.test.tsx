import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { asksCopy } from "@/lib/asks/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import AskView from "./AskView";
import { exampleAskPage, exampleEventAskPage } from "./AsksList.examples";

const link = (name: string) => page.getByRole("link", { name, exact: true });
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("AskView", () => {
  const path = `/staff/asks/${exampleAskPage.slug}`;
  const words = asksCopy.asks.page;
  const list = (answer: string, anyStatus = false) =>
    `/staff/politicians?ask=${exampleAskPage.slug}&answer=${answer}${anyStatus ? "&status=any" : ""}`;

  it("sizes its kind's picture as its title's words, at whatever size they are", async () => {
    // Words larger than the page's own: the title, a heading of 2em, grows with them, and its picture with it.
    await render(
      <div style={{ fontSize: "24px" }}>
        <AskView ask={exampleAskPage} />
      </div>,
    );
    const title = page.getByRole("heading", { level: 1 }).element();
    const picture = title.querySelector("svg")!;
    expect(picture.getBoundingClientRect().height).toBeCloseTo(parseFloat(getComputedStyle(title).fontSize));
    expect(parseFloat(getComputedStyle(title).fontSize)).toBe(48);
  });

  it("leads with what they were asked, then its answers, then how we asked and its counts", async () => {
    await render(<AskView ask={exampleAskPage} />);
    expect(document.body.textContent).toContain(asksCopy.asks.askedThem("PauseAI", "letter").slice(0, 8));
    await expect.element(link(exampleAskPage.ways[0].title)).toHaveAttribute("href", exampleAskPage.ways[0].href);
    // Each kind under its own heading, with how many letters each sent.
    await says(asksCopy.asks.waysOf.campaign);
    await says(asksCopy.asks.waysOf.mailing);
    expect(document.body.textContent).toContain(`${exampleAskPage.ways[0].title}${words.letters(19)}`);
    await expect.element(link(asksCopy.asks.edit)).toHaveAttribute("href", `${path}/edit`);
    await says(`5 ${words.replied}`);
    await says(`40 ${words.lettersWord(40)}`);
    await expect.element(link("Polly Placeholder")).toHaveAttribute("href", "/staff/politicians/10");
  });

  it("gives a letter the months of its letters, or with none the month typed, and an event its day", async () => {
    const { rerender } = await render(<AskView ask={exampleAskPage} />);
    await says(words.when);
    await says("Jun–Nov 2026");
    await rerender(<AskView ask={{ ...exampleAskPage, date: "2026-06-01", firstLetter: null, lastLetter: null }} />);
    await says("Jun 2026");
    await rerender(<AskView ask={{ ...exampleAskPage, kind: "event", date: "2026-11-01" }} />);
    await says(words.on);
    await says("1 Nov 2026");
  });

  it("gives those asked a column first, then each answer, each leading to them on the politicians list", async () => {
    await render(<AskView ask={exampleAskPage} />);
    const heads = [...document.querySelectorAll("h2")].map((h) => h.textContent);
    expect(heads.slice(0, 4)).toEqual([
      `${staffVocabulary.invited.letter} 37`,
      `${staffVocabulary.statuses.signed} 7`,
      `${words.otherAnswers} 0`,
      `${staffVocabulary.statuses.declined} 1`,
    ]);
    // Those asked are in the words of its kind, a letter. One of them is out of office, so their list is too.
    await expect.element(link(`${staffVocabulary.invited.letter} 37`)).toHaveAttribute("href", list("invited", true));
    await expect.element(link(words.allOf(37))).toHaveAttribute("href", list("invited", true));
    // Those who signed are all in office, so their list is of those in office, as the list is unless told.
    await expect.element(link(`${staffVocabulary.statuses.signed} 7`)).toHaveAttribute("href", list("signed"));
    await expect.element(link(words.allOf(7))).toHaveAttribute("href", list("signed"));
    // Every one of a column shown: the way to them says so, with no count.
    await expect.element(link(words.asList)).toHaveAttribute("href", list("declined"));
    // Someone out of office says how they left, after their party.
    await says(`Example Party · ${staffVocabulary.personStatuses.retired}`);
    expect(document.body.textContent).not.toContain(staffVocabulary.personStatuses.in_office);
    // Nobody in a yes or no column is tagged: the column's name says their answer.
    expect(page.getByText(staffVocabulary.statuses.signed, { exact: true }).all()).toHaveLength(1);
    // Nobody gave it: no link, and it says so.
    expect(link(`${words.otherAnswers} 0`).query()).toBeNull();
    await says(words.none);
  });

  it("tags each other answer with what it was, and has no column of those asked when there are none", async () => {
    await render(<AskView ask={exampleEventAskPage} />);
    await says(`${words.otherAnswers} 2`);
    await says("Tentatively said yes");
    expect(page.getByText(staffVocabulary.statuses.other, { exact: true }).query()).toBeNull();
    expect(document.body.textContent).not.toContain(staffVocabulary.invited.event);
  });

  it("an event: Edit, a link on our site or another's, and when there's nothing", async () => {
    const { rerender } = await render(<AskView ask={{ ...exampleEventAskPage, url: "/events" }} />);
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
          writtenTo: 0,
        }}
      />,
    );
    await expect.element(link(words.theLink.letter)).toHaveAttribute("target", "_blank");
    await says(words.noWay);
    await says(words.none);
    // Nobody has answered, but some were asked: their column still shows, and for an event says they're invited.
    await rerender(<AskView ask={{ ...exampleAskPage, counts: {} }} />);
    await expect.element(link(`${staffVocabulary.invited.letter} 37`)).toBeVisible();
    await rerender(<AskView ask={{ ...exampleAskPage, kind: "event", counts: {} }} />);
    await expect.element(link(`${staffVocabulary.invited.event} 37`)).toBeVisible();
  });
});
