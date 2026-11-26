import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused, type FormResult } from "@/lib/form-result";
import type { Find, PressPage } from "@/lib/press/finds.server";
import PressFinds, { AddPiece, type PressActions } from "./PressFinds";
import { AddPieceExample, PressFindsExample } from "./PressFinds.gallery.client";
import { EXAMPLE_PRESS_PAGE } from "./PressFinds.examples";
import { pressPageCopy as copy } from "./copy";
import { RefusalPlace } from "../ui/ResultForm";

/** Each action, logging the forms it's sent and done, unless `answer` says otherwise. */
function actions(answer: FormResult<"gone"> = { ok: true }) {
  const sent: [string, Record<string, string>][] = [];
  const act = (name: string) =>
    vi.fn(async (form: FormData) => {
      sent.push([name, Object.fromEntries([...form].map(([key, value]) => [key, String(value)]))]);
      return answer;
    });
  const all = {
    add: act("add"),
    turnDown: act("turnDown"),
    restore: act("restore"),
    edit: act("edit"),
    editFind: act("editFind"),
    remove: act("remove"),
  } as unknown as PressActions;
  return { all, sent };
}

/** A field by its label's start, as a field inside its label adds its value to the label's name. */
const field = (label: string) => new RegExp(`^${label}`);

const card = (title: string) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name: title }) });

/** A find waiting, as the example's first, with `changes`. */
const waitingFind = (changes: Partial<Find>): Find => ({ ...EXAMPLE_PRESS_PAGE.waiting[0], ...changes });

describe("the staff Press page's lists", () => {
  it("shows each find waiting with the LLM's verdict, where and when, its kind, the passage and why", async () => {
    const { all } = actions();
    await render(<PressFinds page={EXAMPLE_PRESS_PAGE} actions={all} />);
    await expect.element(page.getByRole("heading", { name: `${copy.waiting.title} 3` })).toBeVisible();
    const march = card("Protesters march on Whitehall");
    await expect.element(march).toMatchTextContent(`${copy.waiting.verdicts.ours} · PauseAI UK`);
    await expect.element(march).toMatchTextContent("The Example Gazette · 14 Oct 2026 · Article");
    await expect.element(march).toMatchTextContent("Campaigners from PauseAI UK outside Downing Street");
    await expect.element(march).toMatchTextContent("A caption names PauseAI UK.");
    await expect
      .element(card("Campaigners call for a pause on frontier AI"))
      .toMatchTextContent(copy.waiting.verdicts.unclear);
    // A page that couldn't be read says so, and why.
    const unread = card("Protesters resort to direct action against AI firms");
    await expect.element(unread).toMatchTextContent(copy.waiting.notReadTag);
    await expect.element(unread).toMatchTextContent(copy.waiting.notRead.refused);
  });

  it("says why each find couldn't be read in words of its own, never the error's", async () => {
    const { all } = actions();
    const failing = (title: string, failure: Find["failure"]) =>
      waitingFind({ title, verdict: null, org: null, reason: null, passage: null, failure });
    const waiting = [
      failing("Google", { service: "google-news", kind: "not-found" }),
      failing("Refused", { service: "news-page", kind: "unauthorised" }),
      failing("Too often", { service: "news-page", kind: "rate-limited" }),
      failing("Not there", { service: "news-page", kind: "not-found" }),
      failing("No answer", { service: "news-page", kind: "unreachable" }),
      failing("Our bug", {}),
    ];
    await render(<PressFinds page={{ ...EXAMPLE_PRESS_PAGE, waiting }} actions={all} />);
    await expect.element(card("Google")).toMatchTextContent(copy.waiting.notRead.noAddress);
    await expect.element(card("Refused")).toMatchTextContent(copy.waiting.notRead.refused);
    await expect.element(card("Too often")).toMatchTextContent(copy.waiting.notRead.busy);
    await expect.element(card("Not there")).toMatchTextContent(copy.waiting.notRead.missing);
    await expect.element(card("No answer")).toMatchTextContent(copy.waiting.notRead.noAnswer);
    await expect.element(card("Our bug")).toMatchTextContent(copy.waiting.notRead.noAnswer);
  });

  it("wraps a word too long for its card, rather than widening the page", async () => {
    const { all } = actions();
    const long =
      "CBMi3AFBVV95cUxQZnZXNk1oSm13bkxrbjJ2ZFpPRGE2VFJtblVwUzAzU2pMN3pfRVU2eGFTUmVXNnlXcWY5TzV2MkZXTllKeW55Q1BCSngx";
    const waiting = [waitingFind({ title: long, passage: long, reason: long })];
    const { container } = await render(
      <div style={{ width: "360px" }}>
        <PressFinds page={{ ...EXAMPLE_PRESS_PAGE, waiting }} actions={all} />
      </div>,
    );
    const li = card(long).element();
    expect(li.scrollWidth).toBeLessThanOrEqual(li.clientWidth);
    expect(li.getBoundingClientRect().right).toBeLessThanOrEqual(
      container.firstElementChild!.getBoundingClientRect().right,
    );
  });

  it("names the verdict alone when the LLM says ours without which PauseAI, and says when it didn't judge", async () => {
    const { all } = actions();
    const waiting = [
      waitingFind({ id: 1, title: "Ours, but which", org: "unclear" }),
      waitingFind({ id: 2, title: "Not judged", verdict: null, org: null, reason: null }),
      waitingFind({ id: 3, title: "Judged not ours", verdict: "not ours", org: "none", note: "Staff's own note" }),
    ];
    await render(<PressFinds page={{ ...EXAMPLE_PRESS_PAGE, waiting }} actions={all} />);
    await expect.element(card("Ours, but which").getByText(copy.waiting.verdicts.ours, { exact: true })).toBeVisible();
    await expect.element(card("Not judged")).toMatchTextContent(copy.waiting.noVerdict);
    await expect.element(card("Judged not ours")).toMatchTextContent(copy.waiting.verdicts["not ours"]);
    // Staff's note stands in place of the LLM's reason.
    await expect.element(card("Judged not ours")).toMatchTextContent("Staff's own note");
    await expect.element(card("Judged not ours")).not.toMatchTextContent("A caption names PauseAI UK.");
  });

  it("tags each find and piece with what kind of news its source is, or that it's unknown", async () => {
    const { all } = actions();
    const waiting = ([1, 2, 3, 4, null] as const).map((tier, id) => waitingFind({ id, title: `Tier ${tier}`, tier }));
    const shown = [
      { ...EXAMPLE_PRESS_PAGE.shown[0], tier: 2 as const },
      { ...EXAMPLE_PRESS_PAGE.shown[1], tier: null },
    ];
    await render(<PressFinds page={{ ...EXAMPLE_PRESS_PAGE, waiting, shown }} actions={all} />);
    await expect.element(card("Tier 1")).toMatchTextContent(copy.tiers[1]);
    await expect.element(card("Tier 2")).toMatchTextContent(copy.tiers[2]);
    await expect.element(card("Tier 3")).toMatchTextContent(copy.tiers[3]);
    await expect.element(card("Tier 4")).toMatchTextContent(copy.tiers[4]);
    await expect.element(card("Tier null")).toMatchTextContent(copy.tiers.none);
    await expect.element(card(shown[0].title)).toMatchTextContent(copy.tiers[2]);
    await expect.element(card(shown[1].title)).toMatchTextContent(copy.tiers.none);
  });

  it("adds, edits and removes a find, each by its id", async () => {
    const { all, sent } = actions();
    await render(<PressFinds page={EXAMPLE_PRESS_PAGE} actions={all} />);
    const march = card("Protesters march on Whitehall");
    await march.getByRole("button", { name: copy.waiting.add }).click();
    await march.getByRole("button", { name: copy.shown.remove }).click();
    await march.getByRole("button", { name: copy.shown.edit }).click();
    // The form starts from what Add would use.
    await expect.element(march.getByLabelText(field(copy.shown.fields.outlet))).toHaveValue("The Example Gazette");
    await expect
      .element(march.getByLabelText(field(copy.shown.fields.note)))
      .toHaveValue("A caption names PauseAI UK.");
    await march.getByLabelText(field(copy.shown.fields.medium)).selectOptions("Video");
    await march.getByRole("button", { name: copy.shown.save }).click();
    await expect.poll(() => sent.map(([name]) => name)).toEqual(["add", "turnDown", "editFind"]);
    expect(sent[2][1]).toMatchObject({ id: "1", medium: "Video", outlet: "The Example Gazette", date: "2026-10-14" });
  });

  it("lists the coverage, each with its kind, a cross-posted piece linking its first platform, to edit or remove", async () => {
    const { all, sent } = actions();
    await render(<PressFinds page={EXAMPLE_PRESS_PAGE} actions={all} />);
    const shown = page.getByRole("listitem").filter({ hasText: "Activists stage protest outside Downing Street" });
    await expect
      .element(shown.getByRole("link", { name: "Activists stage protest outside Downing Street" }))
      .toHaveAttribute("href", "https://www.example.com/video");
    await expect.element(shown).toMatchTextContent("Video");
    await shown.getByRole("button", { name: copy.shown.remove }).click();
    const pause = page.getByRole("listitem").filter({ hasText: "Campaigners call for a pause on AI" });
    await pause.getByRole("button", { name: copy.shown.edit }).click();
    await pause.getByLabelText(field(copy.shown.fields.title)).fill("A better headline");
    await pause.getByRole("button", { name: copy.shown.save }).click();
    await expect
      .poll(() => sent.map(([name, form]) => [name, form.id]))
      .toEqual([
        ["remove", "51"],
        ["edit", "52"],
      ]);
    expect(sent[1][1]).toMatchObject({ title: "A better headline", note: "Quotes Joseph Miller of PauseAI UK." });
  });

  it("folds what's removed, finds and pieces, newest first, each to add again", async () => {
    const { all, sent } = actions();
    const removed = [{ ...EXAMPLE_PRESS_PAGE.removed[0], note: "Why it was on /press" }];
    await render(<PressFinds page={{ ...EXAMPLE_PRESS_PAGE, removed }} actions={all} />);
    await page.getByRole("heading", { name: new RegExp(`^${copy.removed.title}`) }).click();
    const items = page.getByRole("group").getByRole("listitem");
    // The piece was removed after the find, so it's first.
    await expect.element(items.nth(0)).toMatchTextContent("AI summit opens in Seoul");
    await expect.element(items.nth(0)).toMatchTextContent("Why it was on /press");
    await expect.element(items.nth(1)).toMatchTextContent("Bank to pause AI loan decisions");
    await items.nth(0).getByRole("button", { name: copy.waiting.add }).click();
    await items.nth(1).getByRole("button", { name: copy.waiting.add }).click();
    await expect
      .poll(() => sent.map(([name, form]) => [name, form.id]))
      .toEqual([
        ["restore", "50"],
        ["add", "4"],
      ]);
  });

  it("leaves out Waiting and Removed when there's nothing in them", async () => {
    const { all } = actions();
    const page_: PressPage = { ...EXAMPLE_PRESS_PAGE, waiting: [], notOurs: [], removed: [] };
    await render(<PressFinds page={page_} actions={all} />);
    await expect.element(page.getByRole("heading", { name: `${copy.shown.title} 2` })).toBeVisible();
    await expect.element(page.getByRole("heading", { name: new RegExp(copy.waiting.title) })).not.toBeInTheDocument();
    await expect.element(page.getByText(copy.removed.title)).not.toBeInTheDocument();
  });

  it("says why a change wasn't made", async () => {
    const { all } = actions(refused("gone"));
    // "gone" is said at the top of the page.
    await render(
      <RefusalPlace>
        <PressFinds page={EXAMPLE_PRESS_PAGE} actions={all} />
      </RefusalPlace>,
    );
    await card("Protesters march on Whitehall").getByRole("button", { name: copy.waiting.add }).click();
    await expect.element(page.getByText(copy.refused.gone)).toBeVisible();
  });
});

describe("Add a piece", () => {
  it("sends a new piece's link with its fields, and says why one is refused", async () => {
    const forms: FormData[] = [];
    const act = vi.fn(async (form: FormData): Promise<FormResult<"known">> => {
      forms.push(form);
      return forms.length === 1 ? { ok: true } : refused("known");
    });
    await render(<AddPiece act={act} />);
    await page.getByRole("button", { name: copy.shown.addPiece }).click();
    await page.getByLabelText(field(copy.shown.fields.url)).fill("https://www.example.com/radio");
    await page.getByLabelText(field(copy.shown.fields.title)).fill("On the radio");
    await page.getByLabelText(field(copy.shown.fields.outlet)).fill("Example Radio");
    await expect.element(page.getByLabelText(field(copy.shown.fields.medium))).toHaveValue("Article");
    await page.getByRole("button", { name: copy.shown.save }).click();
    await expect.poll(() => forms.length).toBe(1);
    expect(Object.fromEntries(forms[0])).toMatchObject({
      url: "https://www.example.com/radio",
      title: "On the radio",
      outlet: "Example Radio",
      medium: "Article",
    });
    await page.getByRole("button", { name: copy.shown.addPiece }).click();
    await page.getByLabelText(field(copy.shown.fields.url)).fill("https://www.example.com/radio");
    await page.getByLabelText(field(copy.shown.fields.title)).fill("On the radio");
    await page.getByLabelText(field(copy.shown.fields.outlet)).fill("Example Radio");
    await page.getByRole("button", { name: copy.shown.save }).click();
    await expect.element(page.getByText(copy.refused.known)).toBeVisible();
  });
});

describe("the Press page's examples in the gallery", () => {
  it("log what each button sends", async () => {
    await render(
      <>
        <PressFindsExample page={EXAMPLE_PRESS_PAGE} />
        <AddPieceExample />
      </>,
    );
    await card("Protesters march on Whitehall").getByRole("button", { name: copy.waiting.add }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem").first())
      .toMatchTextContent('addFindNow({"id":"1"})');
  });
});
