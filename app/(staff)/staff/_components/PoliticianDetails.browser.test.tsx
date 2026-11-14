import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { campaigns } from "@/lib/content/email-your-mp";
import { staffDate, staffTime } from "@/lib/staff-time";
import { staffCopy } from "@/lib/content/staff-interface";
import { exampleBlock } from "./EmailBlocksTable.examples";
import { exampleLetter } from "./LettersTable.examples";
import { exampleHiddenOneOff, exampleOneOffs } from "./CampaignPages.examples";
import PoliticianCorrespondence from "./PoliticianCorrespondence";
import PoliticianDetails from "./PoliticianDetails";
import { type ThreadMessages, type ThreadStep } from "@/lib/politician-correspondence";
import { exampleNotes, exampleNotesAt, exampleNoteWriter } from "./Notes.examples";
import { exampleAliases, exampleAsks, examplePolitician, examplePoliticianHistory } from "./PoliticianTable.examples";
import AddAliasForm from "./AddAliasForm";
import { action } from "@/tests/browser/staff";

const [pm] = campaigns;

// No emails either way, so the band counts none but in the tests that give some.
const MP = { ...examplePolitician, emailsToThem: 0, emailsFromThem: 0 };

const ask = (slug: string) => exampleAsks.find((a) => a.slug === slug)!;

describe("PoliticianDetails", () => {
  const none = {
    asks: exampleAsks,
    setStatus: vi.fn(),
    letters: { senders: false as const, letters: [] },
    history: [],
  };

  const definitions = () =>
    page
      .getByRole("definition")
      .all()
      .map((dd) => dd.element().textContent);
  const terms = () =>
    page
      .getByRole("term")
      .all()
      .map((dt) => dt.element().textContent);
  const openFolds = () => document.querySelectorAll("details").forEach((fold) => (fold.open = true));

  it("heads the page with a band of who they are, beside counts, then their correspondence beside their asks and notes", async () => {
    const { rerender } = await render(
      <PoliticianDetails
        politician={{ ...MP, airtableId: null, officialId: null, email: null }}
        unblock={vi.fn()}
        {...none}
      />,
    );
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent(MP.name);
    await expect.element(page.getByText(staffCopy.politician.importantTarget)).toBeVisible();
    // Their party, status and nation, the party's and the nation's with an icon; how to write to them.
    expect(terms()).toEqual([
      staffCopy.fields.party,
      staffCopy.politician.status,
      staffCopy.politician.country,
      staffCopy.fields.email,
    ]);
    expect(definitions()).toEqual([
      MP.party,
      staffCopy.personStatuses.in_office,
      staffCopy.countries.england,
      staffCopy.politicians.noEmail,
      // Their salutation, quietly under their email.
      staffCopy.politician.editDetails.dear(MP.salutation),
    ]);
    // Their marks, in a card of their own under the notes: without a way to change them, the switches can't be pressed.
    const marks = page.getByRole("region", { name: staffCopy.politician.marks });
    await expect.element(marks.getByRole("switch", { name: staffCopy.politician.importantTarget })).toBeChecked();
    await expect.element(marks.getByRole("switch", { name: staffCopy.politician.personalConnection })).toBeDisabled();
    // Where they came from, quietly, at the top right.
    await expect
      .element(page.getByText(`${staffCopy.politician.source} ${staffCopy.politician.sources.staff}`))
      .toBeVisible();
    expect(document.querySelectorAll("dd svg[aria-hidden]")).toHaveLength(2);
    // No emails either way, so only the asks agreed: MP signed one.
    const counts = document.querySelector("[class*=counts]")!;
    expect(counts.querySelector("a")?.getAttribute("href")).toBe(`/staff/politicians/${MP.id}#asks-title`);
    expect([...counts.children].map((count) => count.textContent)).toEqual([
      `1 ${staffCopy.politician.band.asksAgreed(1)}`,
    ]);
    // Not PauseAI's emails: they're in the history.
    expect(page.getByRole("link", { name: /from PauseAI/ }).query()).toBeNull();
    await expect.element(page.getByRole("region", { name: staffCopy.politician.statusesTitle })).toBeVisible();
    // An empty history still opens, its count 0, to say there's nothing yet.
    const history = page
      .getByRole("heading", { name: staffCopy.politician.historyTitle })
      .element()
      .closest("details")!;
    expect(history.querySelector("summary")!.textContent).toBe(`${staffCopy.politician.historyTitle} 0`);
    history.open = true;
    await expect.element(page.getByText(staffCopy.politician.noHistory)).toBeVisible();
    // Without staff's notes, no way to write one.
    await expect.element(page.getByRole("button", { name: staffCopy.notes.write })).not.toBeInTheDocument();
    // A personal connection is a tag too; none of the rest is there for someone without them.
    await rerender(
      <PoliticianDetails
        politician={{ ...MP, importantTarget: false, personalConnection: true, country: null }}
        unblock={vi.fn()}
        {...none}
      />,
    );
    await expect.element(page.getByText(staffCopy.politician.personalConnection)).toBeVisible();
  });

  it("links their address, to write to them, and has no party or country for someone with none", async () => {
    await render(
      <PoliticianDetails
        politician={{ ...MP, party: "", country: null, status: "retired" }}
        unblock={vi.fn()}
        {...none}
      />,
    );
    await expect.element(page.getByRole("link", { name: MP.email! })).toHaveAttribute("href", `mailto:${MP.email}`);
    expect(terms()).toEqual([staffCopy.politician.status, staffCopy.fields.email]);
  });

  it("sets a Lord's email from the bubble on it in the band, saying why it's theirs to set while they have none", async () => {
    const lord = (email: string | null) => (
      <PoliticianDetails
        politician={{ ...MP, house: "lords", constituency: null, email }}
        unblock={vi.fn()}
        editDetails={vi.fn()}
        aliases={{ ...exampleAliases, email }}
        aliasActions={{ add: vi.fn(), remove: vi.fn() }}
        aliasesOpen
        {...none}
      />
    );
    const words = staffCopy.politician.editDetails;
    const { rerender } = await render(lord(null));
    await expect.element(page.getByRole("button", { name: words.add })).toBeVisible();
    await expect.element(page.getByText(words.emailHint)).toBeVisible();
    await expect.element(page.getByRole("textbox", { name: words.email })).toBeVisible();
    await rerender(lord("lord.example@parliament.uk"));
    await expect.element(page.getByRole("button", { name: staffCopy.politician.aliases.more(7) })).toBeVisible();
    await expect.element(page.getByText(words.emailHint)).not.toBeInTheDocument();
  });

  it("shows a test politician's salutation, as a letter to them starts, with no edit", async () => {
    await render(
      <PoliticianDetails
        politician={{ ...MP, isTest: true }}
        unblock={vi.fn()}
        editDetails={vi.fn()}
        aliases={exampleAliases}
        aliasActions={{ add: vi.fn(), remove: vi.fn() }}
        {...none}
      />,
    );
    const words = staffCopy.politician.editDetails;
    await expect.element(page.getByText(words.dear(MP.salutation))).toBeVisible();
    await expect.element(page.getByRole("button", { name: words.edit })).not.toBeInTheDocument();
  });

  it("says a salutation made from the name is so, and sets Ms or Mr with their surname from its bubble", async () => {
    const { fn, sent } = action();
    const politician = { ...MP, salutation: MP.name, salutationToCheck: true, importantTarget: false };
    const { rerender } = await render(
      <PoliticianDetails
        politician={politician}
        unblock={vi.fn()}
        editDetails={async (form) => {
          fn(form);
          return { saved: true };
        }}
        {...none}
      />,
    );
    const words = staffCopy.politician.editDetails;
    await page.getByRole("button", { name: words.edit }).click();
    // In its bubble: that it's their name, and the two it most likely is.
    await expect.element(page.getByText(words.fromName)).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Mr Placeholder" })).toBeVisible();
    await page.getByRole("button", { name: "Ms Placeholder" }).click();
    await vi.waitFor(() => expect(sent).toEqual([{ politicianId: String(MP.id), salutation: "Ms Placeholder" }]));
    // Without a way to change it, the salutation alone.
    await rerender(<PoliticianDetails politician={politician} unblock={vi.fn()} {...none} />);
    await expect.element(page.getByText(words.dear(MP.name))).toBeVisible();
    await expect.element(page.getByRole("button", { name: words.edit })).not.toBeInTheDocument();
  });

  it("saves a salutation from its bubble, which stays open when the server gives no answer", async () => {
    const editDetails = vi.fn(async () => undefined);
    await render(<PoliticianDetails politician={MP} unblock={vi.fn()} editDetails={editDetails} {...none} />);
    const words = staffCopy.politician.editDetails;
    await page.getByRole("button", { name: words.edit }).click();
    await page.getByRole("button", { name: words.save }).click();
    await vi.waitFor(() => expect(editDetails).toHaveBeenCalledOnce());
    await expect.element(page.getByRole("textbox", { name: words.salutation })).toBeVisible();
  });

  it("turns a marker on or off with its switch in the Marks card", async () => {
    const { fn, sent } = action();
    await render(<PoliticianDetails politician={MP} unblock={vi.fn()} setMark={fn} {...none} />);
    const important = page.getByRole("switch", { name: staffCopy.politician.importantTarget });
    await expect.element(important).toHaveAttribute("aria-checked", "true");
    await page.getByRole("switch", { name: staffCopy.politician.personalConnection }).click();
    await vi.waitFor(() =>
      expect(sent).toEqual([{ politicianId: String(MP.id), mark: "personalConnection", on: "true" }]),
    );
  });

  it("links each politician to their page on their body's site, saying if their Airtable record has gone", async () => {
    for (const [politician, source, href] of [
      [MP, staffCopy.politician.sources.parliament, "https://members.parliament.uk/member/90002"],
      [
        { ...MP, house: "senedd" as const, officialId: 5053 },
        staffCopy.politician.sources.senedd,
        "https://business.senedd.wales/mgUserInfo.aspx?UID=5053",
      ],
      [{ ...MP, officialId: null }, staffCopy.politician.sources.airtable, undefined],
      [{ ...MP, airtableId: null, officialId: null, isTest: true }, staffCopy.politician.sources.test, undefined],
    ] as const) {
      const { unmount } = await render(<PoliticianDetails politician={politician} unblock={vi.fn()} {...none} />);
      await expect
        .element(page.getByText(staffCopy.politician.source, { exact: false }))
        .toHaveTextContent(`${staffCopy.politician.source} ${source}`);
      const link = page.getByRole("link", { name: source, exact: true });
      if (href) {
        await expect.element(link).toHaveAttribute("href", href);
        await expect.element(link).toHaveAttribute("target", "_blank");
      } else {
        await expect.element(link).not.toBeInTheDocument();
      }
      await unmount();
    }
  });

  it("drafts a note in a notes card with nothing in it yet", async () => {
    await render(
      <PoliticianDetails
        politician={MP}
        unblock={vi.fn()}
        {...none}
        notes={{
          notes: [],
          reader: exampleNoteWriter,
          at: exampleNotesAt,
          add: vi.fn(),
          edit: vi.fn(),
          remove: vi.fn(),
        }}
      />,
    );
    await expect.element(page.getByText(staffCopy.notes.none)).toBeVisible();
    await page.getByRole("button", { name: staffCopy.notes.write }).click();
    await expect.element(page.getByText(staffCopy.notes.none)).not.toBeInTheDocument();
    await expect
      .element(
        page.getByRole("list", { name: staffCopy.notes.title }).getByRole("textbox", { name: staffCopy.notes.note }),
      )
      .toBeVisible();
  });

  it("puts staff's notes in their card, to change there, and in the history as plain lines", async () => {
    const add = vi.fn();
    await render(
      <PoliticianDetails
        politician={MP}
        unblock={vi.fn()}
        {...none}
        notes={{
          notes: exampleNotes,
          reader: exampleNoteWriter,
          at: exampleNotesAt,
          add,
          edit: vi.fn(),
          remove: vi.fn(),
        }}
      />,
    );
    const notes = page.getByRole("list", { name: staffCopy.notes.title }).getByRole("listitem");
    await expect.element(notes.nth(0)).toBeVisible();
    expect(notes.nth(0).element().textContent).toContain(exampleNotes[0].body);
    await expect.element(notes.nth(0).getByRole("button", { name: staffCopy.notes.edit })).toBeVisible();
    openFolds();
    const history = page.getByRole("list", { name: staffCopy.politician.historyTitle }).getByRole("listitem");
    expect(history.nth(0).element().textContent).toContain(
      `${staffTime(exampleNotes[0].createdAt)}${exampleNotes[0].body} · ${staffCopy.politician.history.note} · jo@pauseai.uk`,
    );
    expect(history.nth(0).getByRole("button").query()).toBeNull();
    // Write a note drafts it at the top of the card, and goes while it's there.
    const write = page.getByRole("button", { name: staffCopy.notes.write });
    await write.click();
    await expect.element(write).not.toBeInTheDocument();
    await expect.element(page.getByRole("textbox", { name: staffCopy.notes.note })).toHaveFocus();
    expect(notes.nth(0).element().textContent).toContain(`${staffCopy.politician.history.note} · jo@pauseai.uk`);
    // Cancel takes it away.
    await page.getByRole("button", { name: staffCopy.notes.cancel }).click();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
    expect(notes.nth(0).element().textContent).toContain(exampleNotes[0].body);
    await write.click();
    await page.getByRole("textbox", { name: staffCopy.notes.note }).fill("Met them");
    await page.getByRole("button", { name: staffCopy.notes.add }).click();
    expect(Object.fromEntries((add.mock.calls[0][0] as FormData).entries())).toEqual({
      politicianId: String(MP.id),
      body: "Met them",
    });
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
    // Ctrl+Enter adds one too.
    await write.click();
    await page.getByRole("textbox", { name: staffCopy.notes.note }).fill("Again");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await vi.waitFor(() => expect(add).toHaveBeenCalledTimes(2));
  });

  describe("their correspondence", () => {
    const words = staffCopy.politician.correspondence;
    const kinds = staffCopy.allLetters.topicKinds;
    const region = () => page.getByRole("region", { name: words.title });
    const step = (at: string, who: ThreadStep["who"], fields: Partial<ThreadStep> = {}): ThreadStep => ({
      at: new Date(at),
      who,
      name: null,
      auto: false,
      ...fields,
    });
    const messages = (fields: Partial<ThreadMessages> = {}): ThreadMessages => ({
      subjects: {},
      letters: {},
      oneOffs: {},
      ...fields,
    });
    const letter = {
      ...exampleLetter,
      id: 21,
      senderName: "Jane Smith",
      ownWords: 0.14,
      createdAt: new Date("2026-10-13T08:00:00Z"),
      repliedAt: null,
    };

    it("says who wrote and when, a real reply marked, an automatic one not, and when nothing came back", async () => {
      await render(
        <PoliticianDetails
          {...none}
          politician={MP}
          unblock={vi.fn()}
          letters={{ senders: true, letters: [letter] }}
          pauseaiLetters={[
            {
              id: 22,
              mailingId: 3,
              mailing: "Example Mailing",
              status: "sent",
              personalised: false,
              at: new Date("2026-09-02T08:00:00Z"),
            },
          ]}
          oneOffs={[
            {
              ...exampleOneOffs[0],
              id: 23,
              subject: "",
              someoneElse: false,
              latestAt: new Date("2026-08-05T08:00:00Z"),
            },
          ]}
          messages={messages({
            letters: {
              21: [
                step("2026-10-13T08:00:00Z", "supporter"),
                step("2026-10-13T09:00:00Z", "them", { auto: true }),
                step("2026-10-14T09:00:00Z", "them", { name: "Polly Placeholder" }),
                step("2026-10-15T09:00:00Z", "us"),
                step("2026-10-16T09:00:00Z", "them"),
                step("2026-10-17T09:00:00Z", "supporter"),
              ],
            },
            oneOffs: {
              23: [step("2026-08-04T08:00:00Z", "us"), step("2026-08-05T08:00:00Z", "them", { name: "Polly" })],
            },
          })}
        />,
      );
      const items = region().getByRole("listitem");
      expect(items.nth(0).element().textContent).toBe(
        [
          `${pm.title} ${kinds.campaign}${staffCopy.letters.columns.ownWords} ${staffCopy.letters.ownWords(0.14)}`,
          words.wrote("Jane Smith", "13 Oct 2026"),
          words.auto("13 Oct 2026"),
          words.replied("Polly Placeholder", "14 Oct 2026"),
          words.usReplied("15 Oct 2026"),
          words.replied(words.office, "16 Oct 2026"),
          words.replied("Jane Smith", "17 Oct 2026"),
        ].join(""),
      );
      await expect.element(items.nth(0).getByRole("link")).toHaveAttribute("href", "/staff/letters/21");
      const reply = items.nth(0).getByText(words.replied("Polly Placeholder", "14 Oct 2026"));
      const auto = items.nth(0).getByText(words.auto("13 Oct 2026"));
      expect(getComputedStyle(reply.element()).fontWeight).toBe("600");
      expect(getComputedStyle(auto.element()).fontWeight).not.toBe("600");
      expect(items.nth(1).element().textContent).toBe(
        `Example Mailing ${kinds.mailing}${words.sent("2 Sept 2026")}${words.noReply}`,
      );
      await expect.element(items.nth(1).getByRole("link")).toHaveAttribute("href", "/staff/mailings/3/letters/22");
      expect(items.nth(2).element().textContent).toBe(
        `${staffCopy.oneOff.noSubject} ${kinds.oneOff}${words.sent("4 Aug 2026")}${words.replied("Polly", "5 Aug 2026")}`,
      );
    });

    it("heads them by month and year, and opens the rest in place, a month not named twice", async () => {
      await render(
        <PoliticianCorrespondence
          threads={Array.from({ length: 10 }, (_, i) => ({
            key: `t${i}`,
            kind: "oneOff" as const,
            title: `Thread ${i}`,
            href: `/staff/one-off/${i}`,
            at: new Date("2020-10-13T08:00:00.000Z"),
            sender: null,
            status: null,
            ownWords: 0.01,
            someoneElse: false,
            steps: [],
            noReply: true,
          }))}
        />,
      );
      expect(
        page
          .getByRole("heading")
          .all()
          .map((h) => h.element().textContent),
      ).toEqual(["2020"]);
      expect(page.getByRole("link").all()).toHaveLength(8);
      expect(page.getByText(staffCopy.letters.columns.ownWords, { exact: false }).query()).toBeNull();
      await page.getByText(words.all(10)).click();
      expect(page.getByRole("link").all()).toHaveLength(10);
      expect(page.getByRole("heading").all()).toHaveLength(1);
      expect(page.getByText(words.all(10)).element().checkVisibility()).toBe(false);
    });

    it("says when there's nothing, and shows the band's counts only when there are any, leading to All emails", async () => {
      const { rerender } = await render(<PoliticianDetails {...none} politician={MP} unblock={vi.fn()} />);
      await expect.element(region().getByText(words.none)).toBeVisible();
      expect(page.getByRole("link", { name: staffCopy.politician.band.emailsToThem }).query()).toBeNull();
      expect(page.getByRole("link", { name: staffCopy.politician.band.emailsFromThem }).query()).toBeNull();
      await rerender(
        <PoliticianDetails {...none} politician={{ ...MP, emailsToThem: 3, emailsFromThem: 2 }} unblock={vi.fn()} />,
      );
      await expect
        .element(page.getByRole("link", { name: `3 ${staffCopy.politician.band.emailsToThem}` }))
        .toHaveAttribute("href", `/staff/politicians/${MP.id}#correspondence-title`);
      await expect
        .element(page.getByRole("link", { name: `2 ${staffCopy.politician.band.emailsFromThem}` }))
        .toHaveAttribute("href", `/staff/politicians/${MP.id}?correspondence=replies`);
      await expect
        .element(page.getByRole("link", { name: `1 ${staffCopy.politician.band.asksAgreed(1)}` }))
        .toHaveAttribute("href", `/staff/politicians/${MP.id}#asks-title`);
    });

    it("shows only the threads they've replied on, from Emails from them, which then leads back", async () => {
      const props = {
        ...none,
        politician: { ...MP, emailsFromThem: 1 },
        unblock: vi.fn(),
        letters: { senders: true as const, letters: [letter, { ...letter, id: 26 }] },
        messages: messages({
          subjects: { 21: "Answered one", 26: "Unanswered one" },
          letters: { 21: [step("2026-10-13T08:00:00Z", "supporter"), step("2026-10-14T09:00:00Z", "them")] },
        }),
      };
      const { rerender } = await render(<PoliticianDetails {...props} />);
      const tile = page.getByRole("link", { name: `1 ${staffCopy.politician.band.emailsFromThem}` });
      await expect.element(region().getByRole("link", { name: "Unanswered one" })).toBeVisible();
      expect(tile.element().getAttribute("aria-current")).toBeNull();
      await rerender(<PoliticianDetails {...props} onlyReplies />);
      await expect.element(region().getByRole("link", { name: "Answered one" })).toBeVisible();
      expect(region().getByRole("link", { name: "Unanswered one" }).query()).toBeNull();
      await expect.element(tile).toHaveAttribute("aria-current", "true");
      await expect.element(tile).toHaveAttribute("href", `/staff/politicians/${MP.id}`);
    });

    it("has a switch for replies only once they've replied on something, or it's on", async () => {
      const props = {
        ...none,
        politician: MP,
        unblock: vi.fn(),
        letters: { senders: true as const, letters: [letter] },
      };
      const replied = messages({
        letters: { 21: [step("2026-10-13T08:00:00Z", "supporter"), step("2026-10-14T09:00:00Z", "them")] },
      });
      const all = page.getByRole("link", { name: words.allEmails });
      const replies = page.getByRole("link", { name: words.repliesOnly });
      const { rerender } = await render(<PoliticianDetails {...props} />);
      await expect.element(region()).toBeVisible();
      expect(replies.query()).toBeNull();
      await rerender(<PoliticianDetails {...props} messages={replied} />);
      await expect.element(all).toHaveAttribute("aria-current", "page");
      await expect.element(all).toHaveAttribute("href", `/staff/politicians/${MP.id}#correspondence-title`);
      await expect
        .element(replies)
        .toHaveAttribute("href", `/staff/politicians/${MP.id}?correspondence=replies#correspondence-title`);
      await rerender(<PoliticianDetails {...props} onlyReplies />);
      await expect.element(replies).toHaveAttribute("aria-current", "page");
      expect(all.element().getAttribute("aria-current")).toBeNull();
      await expect.element(region().getByText(words.none)).toBeVisible();
    });

    it("tags a thread that's hidden too, after its sealed words", async () => {
      await render(<PoliticianDetails {...none} politician={MP} unblock={vi.fn()} oneOffs={[exampleHiddenOneOff]} />);
      expect(region().getByRole("listitem").first().element().textContent).toContain(
        `${staffCopy.oneOff.hidden} ${kinds.oneOff}`,
      );
    });

    it("names someone else's thread in the history for staff with the permission", async () => {
      await render(
        <PoliticianDetails
          {...none}
          politician={MP}
          unblock={vi.fn()}
          oneOffs={[
            { ...exampleOneOffs[0], id: 23, subject: "Please meet", someoneElse: true },
            { ...exampleOneOffs[0], id: 24, subject: "", someoneElse: true },
          ]}
          messages={messages({
            oneOffs: {
              23: [step("2026-08-05T08:00:00Z", "other", { name: "Vera Volunteer" })],
              24: [step("2026-08-05T08:00:00Z", "us")],
            },
          })}
        />,
      );
      openFolds();
      const history = page.getByRole("list", { name: staffCopy.politician.historyTitle });
      await expect
        .element(
          history.getByText(`${staffCopy.politician.emailFrom("Vera Volunteer")}: Please meet`, { exact: false }),
        )
        .toBeVisible();
      await expect
        .element(history.getByRole("link", { name: staffCopy.allLetters.theThread }).first())
        .toHaveAttribute("href", "/staff/one-off/23");
      await expect
        .element(history.getByText(`${staffCopy.oneOff.title}: ${staffCopy.oneOff.noSubject}`, { exact: false }))
        .toBeVisible();
      await expect
        .element(region().getByText(words.replied("Vera Volunteer", "5 Aug 2026"), { exact: false }))
        .not.toBeInTheDocument();
      await expect.element(region().getByText(words.wrote("Vera Volunteer", "5 Aug 2026"))).toBeVisible();
    });

    it("seals who wrote a letter and any thread with someone else, for staff without the permission", async () => {
      await render(
        <PoliticianDetails
          {...none}
          politician={MP}
          unblock={vi.fn()}
          letters={{
            senders: false,
            letters: [
              {
                id: 21,
                campaign: pm.slug,
                campaignTitle: pm.title,
                status: "made-up",
                createdAt: new Date("2026-10-13T08:00:00Z"),
                repliedAt: null,
              },
              {
                id: 25,
                campaign: pm.slug,
                campaignTitle: pm.title,
                status: "sent",
                createdAt: new Date("2026-09-13T08:00:00Z"),
                repliedAt: null,
              },
            ],
          }}
          oneOffs={[{ ...exampleHiddenOneOff, latestAt: new Date("2026-01-01T08:00:00Z") }]}
          messages={messages({ letters: { 21: [step("2026-10-14T09:00:00Z", "them", { name: "Polly" })] } })}
        />,
      );
      const items = region().getByRole("listitem");
      const sealed = staffCopy.politician.history.unsignedLetter;
      expect(items.first().element().textContent).toContain(`${pm.title} ${kinds.campaign} · made-up`);
      expect(items.first().element().textContent).toContain(`${sealed} 13 Oct 2026`);
      expect(items.first().element().textContent).toContain(words.replied("Polly", "14 Oct 2026"));
      expect(items.nth(1).element().textContent).toContain(staffCopy.letters.status.sent);
      await expect.element(region().getByText(staffCopy.oneOff.hidden)).toBeVisible();
      expect(region().element().querySelector("li a")).toBeNull();
    });
  });

  it("says under their name what they are: in which house, for where, and if they're no longer in office", async () => {
    const { roles, role } = staffCopy.politician;
    for (const [politician, words] of [
      [MP, role(roles.commons, MP.constituency, true)],
      [{ ...MP, house: "lords", constituency: null }, role(roles.lords, null, true)],
      [{ ...MP, status: "died" }, role(roles.commons, MP.constituency, false)],
    ] as const) {
      const { unmount } = await render(<PoliticianDetails politician={politician} unblock={vi.fn()} {...none} />);
      await expect.element(page.getByText(words, { exact: true })).toBeVisible();
      await unmount();
    }
  });

  it("tells one history of the letters to them, the replies and their answers, newest first, and apart what changed their record", async () => {
    // A peer: no constituency, country or notes, so no line for them.
    const peer = { ...MP, constituency: null, country: null, notes: "" };
    const fromPauseai = {
      mailingId: 3,
      mailing: "Example Mailing",
      status: "sent",
      personalised: false,
    };
    await render(
      <PoliticianDetails
        {...none}
        pauseaiLetters={[
          { ...fromPauseai, id: 11, at: new Date("2026-10-03T08:00:00Z"), personalised: true },
          { ...fromPauseai, id: 12, at: new Date("2026-09-02T08:00:00Z") },
          { ...fromPauseai, id: 13, at: new Date("2026-06-01T08:00:00Z"), status: "made-up" },
        ]}
        politician={peer}
        unblock={vi.fn()}
        letters={{
          senders: true,
          letters: [
            { ...exampleLetter, mpName: MP.name, politicianId: MP.id },
            {
              ...exampleLetter,
              id: 2,
              mpName: MP.name,
              politicianId: MP.id,
              senderName: "Anon Writer",
              supporterId: null,
              status: "sent",
              createdAt: new Date("2026-10-13T08:00:00Z"),
              repliedAt: new Date("2026-10-15T09:00:00Z"),
            },
            // A campaign and a status nobody knows any more, shown as they're stored.
            {
              ...exampleLetter,
              id: 3,
              mpName: MP.name,
              politicianId: MP.id,
              senderName: "Old Writer",
              supporterId: null,
              campaign: "old-campaign",
              campaignTitle: "Old campaign, from pauseai.info",
              status: "mislaid",
              createdAt: new Date("2026-07-01T08:00:00Z"),
              repliedAt: null,
            },
          ],
        }}
        history={[
          ...examplePoliticianHistory,
          // Statuses logged by campaign, before asks, and by an ask no longer listed.
          {
            id: 8,
            at: new Date("2026-09-01T10:00:00Z"),
            actor: "jo@pauseai.uk",
            action: "set status",
            details: { politicianId: 7, campaign: "gone", status: null, note: "" },
          },
          {
            id: 7,
            at: new Date("2026-08-15T10:00:00Z"),
            actor: "jo@pauseai.uk",
            action: "set status",
            details: { politicianId: 7, campaign: pm.slug, status: "odd", note: "" },
          },
          {
            id: 10,
            at: new Date("2026-08-12T10:00:00Z"),
            actor: "airtable",
            action: "set status",
            details: { politicianId: 7, ask: "an-old-ask", status: "signed", note: "" },
          },
          {
            id: 6,
            at: new Date("2026-08-10T10:00:00Z"),
            actor: "postmark",
            action: "block address",
            details: { address: "polly@example.org", kind: "weird" },
          },
          { id: 5, at: new Date("2026-08-01T10:00:00Z"), actor: "x", action: "strange", details: {} },
          {
            id: 9,
            at: new Date("2026-07-20T10:00:00Z"),
            actor: "sync",
            action: "edit politician",
            details: { id: 7, name: "Polly Placeholder", changed: { party: ["Labour", "Labour (Co-op)"] } },
          },
          {
            id: 4,
            at: new Date("2026-07-15T10:00:00Z"),
            actor: "import",
            action: "add politician",
            details: { politicianId: 7, name: "Polly Placeholder" },
          },
        ]}
      />,
    );
    // No constituency or nation, so no nation in the band.
    expect(terms()).not.toContain(staffCopy.politician.country);
    openFolds();
    // The sender leads to their supporter once they're one; the letters and replies sit among the audit log's entries by time.
    await expect
      .element(page.getByRole("link", { name: exampleLetter.senderName }))
      .toHaveAttribute("href", "/staff/supporters/7");
    await expect.element(page.getByRole("link", { name: "Anon Writer" })).not.toBeInTheDocument();
    const statusLine = (words: { before: string; after: string }, name: string) =>
      `${words.before}${name}${words.after}`;
    const history = page.getByRole("list", { name: staffCopy.politician.historyTitle }).getByRole("listitem").all();
    const copy = staffCopy.politician.history;
    expect(history.map((item) => item.element().textContent)).toEqual([
      `15 Oct 2026, 09:00${copy["letter-replied"]} Anon Writer · ${pm.title} · ${staffCopy.mailingPages.theLetter}`,
      `13 Oct 2026, 08:00${copy.letter} Anon Writer · ${pm.title} · ${staffCopy.letters.status.sent} · ${staffCopy.mailingPages.theLetter}`,
      `12 Oct 2026, 09:00${copy.letter} ${exampleLetter.senderName} · ${pm.title} · ${staffCopy.letters.status.bounced} · ${staffCopy.mailingPages.theLetter}`,
      `3 Oct 2026, 08:00${copy["pauseai-letter"]} Example Mailing · ${staffCopy.politician.personalised} · ${staffCopy.letters.status.sent} · ${staffCopy.mailingPages.theLetter}`,
      // Dated the day before it was recorded, so on that day.
      `1 Oct 2026${statusLine(staffCopy.politician.statusSet(staffCopy.statuses.signed), ask("frontier-ai-letter").title)} · Told us at the march · jo@pauseai.uk`,
      `2 Sept 2026, 08:00${copy["pauseai-letter"]} Example Mailing · ${staffCopy.letters.status.sent} · ${staffCopy.mailingPages.theLetter}`,
      `1 Sept 2026, 10:00${statusLine(staffCopy.politician.statusCleared, "gone")} · jo@pauseai.uk`,
      `15 Aug 2026, 10:00${statusLine(staffCopy.politician.statusSet("odd"), pm.title)} · jo@pauseai.uk`,
      `12 Aug 2026, 10:00${statusLine(staffCopy.politician.statusSet(staffCopy.statuses.signed), "an-old-ask")} · airtable`,
      `1 Jul 2026, 08:00${copy.letter} Old Writer · Old campaign, from pauseai.info · mislaid · ${staffCopy.mailingPages.theLetter}`,
      `1 Jun 2026, 08:00${copy["pauseai-letter"]} Example Mailing · made-up · ${staffCopy.mailingPages.theLetter}`,
    ]);
    // What changed their record, with who, apart from the answers.
    const record = page.getByRole("heading", { name: staffCopy.politician.recordTitle }).element().closest("details")!;
    // A timeline, newest first: what, then when and who.
    expect([...record.querySelectorAll("ol li")].map((row) => row.textContent)).toEqual([
      `${copy["unblock address"]} polly.placeholder.mp@parliament.uk · Fixed in Airtable14 Oct 2026, 09:30 · jo@pauseai.uk`,
      `${copy["block address"]} polly.placeholder.mp@parliament.uk · ${staffCopy.emails.kinds.hard}12 Oct 2026, 09:10 · postmark`,
      `${copy["edit politician"]} Polly Placeholder · polly.placeholder.mp@parliament.uk30 Sept 2026, 10:00 · samuel.whitlock@pauseai.uk`,
      `${copy["block address"]} polly@example.org · weird10 Aug 2026, 10:00 · postmark`,
      "strange1 Aug 2026, 10:00 · x",
      `${copy["edit politician"]} Polly Placeholder · ${staffCopy.fields.party} Labour → Labour (Co-op)20 Jul 2026, 10:00 · sync`,
      `${copy["add politician"]} Polly Placeholder15 Jul 2026, 10:00 · import`,
    ]);
    // An answer leads to everyone who gave it, the ask to the letter as in the asks card, PauseAI's email to its
    // mailing, an address to its block.
    const historyList = page.getByRole("list", { name: staffCopy.politician.historyTitle });
    // An answer stays plain words, as the asks card beside it has it.
    expect(historyList.getByRole("link", { name: staffCopy.statuses.signed }).query()).toBeNull();
    await expect
      .element(historyList.getByRole("link", { name: ask("frontier-ai-letter").title }))
      .toHaveAttribute("href", "/staff/asks/frontier-ai-letter");
    await expect
      .element(historyList.getByRole("link", { name: "Example Mailing" }).first())
      .toHaveAttribute("href", "/staff/mailings/3");
    await expect
      .element(page.getByRole("link", { name: "polly@example.org" }))
      .toHaveAttribute("href", "/staff/politicians/addresses-to-fix?q=polly%40example.org");
    // Each letter's status leads to it alone on the letters page.
    await expect
      .element(historyList.getByRole("link", { name: staffCopy.mailingPages.theLetter }).nth(2))
      .toHaveAttribute("href", `/staff/letters/${exampleLetter.id}`);
    // Each campaign it names leads to its page here.
    const list = page.getByRole("list", { name: staffCopy.politician.historyTitle });
    const links = list.getByRole("link", { name: pm.title, exact: true }).all();
    expect(links.length).toBeGreaterThan(1);
    for (const link of links) await expect.element(link).toHaveAttribute("href", `/staff/campaigns/${pm.slug}`);
    await expect
      .element(list.getByRole("link", { name: "Old campaign, from pauseai.info" }))
      .toHaveAttribute("href", "/staff/campaigns/old-campaign");
    await expect.element(list.getByRole("link", { name: "gone" })).toHaveAttribute("href", "/staff/campaigns/gone");
  });

  it("without senders, lists each letter and reply by campaign and status alone, linking to no letter", async () => {
    await render(
      <PoliticianDetails
        {...none}
        pauseaiLetters={[
          {
            id: 11,
            mailingId: 3,
            mailing: "Example Mailing",
            status: "sent",
            personalised: false,
            at: new Date("2026-06-01T08:00:00Z"),
          },
          {
            id: 12,
            mailingId: 3,
            mailing: "Example Mailing",
            status: "made-up",
            personalised: false,
            at: new Date("2026-05-01T08:00:00Z"),
          },
        ]}
        politician={MP}
        unblock={vi.fn()}
        letters={{
          senders: false,
          letters: [
            {
              id: 2,
              campaign: pm.slug,
              campaignTitle: pm.title,
              status: "sent",
              createdAt: new Date("2026-10-13T08:00:00Z"),
              repliedAt: new Date("2026-10-15T09:00:00Z"),
            },
            {
              id: 1,
              campaign: "old-campaign",
              campaignTitle: "Old campaign, from pauseai.info",
              status: "mislaid",
              createdAt: new Date("2026-07-01T08:00:00Z"),
              repliedAt: null,
            },
          ],
        }}
      />,
    );
    openFolds();
    const copy = staffCopy.politician.history;
    const list = page.getByRole("list", { name: staffCopy.politician.historyTitle });
    expect(
      list
        .getByRole("listitem")
        .all()
        .map((item) => item.element().textContent),
    ).toEqual([
      `15 Oct 2026, 09:00${copy["unsigned-letter-replied"]} · ${pm.title}`,
      `13 Oct 2026, 08:00${copy.unsignedLetter} · ${pm.title} · ${staffCopy.letters.status.sent}`,
      `1 Jul 2026, 08:00${copy.unsignedLetter} · Old campaign, from pauseai.info · mislaid`,
      `1 Jun 2026, 08:00${copy["pauseai-letter"]} Example Mailing · ${staffCopy.letters.status.sent} · ${staffCopy.mailingPages.theLetter}`,
      `1 May 2026, 08:00${copy["pauseai-letter"]} Example Mailing · made-up · ${staffCopy.mailingPages.theLetter}`,
    ]);
    expect(list.element().querySelector('a[href^="/staff/letters"]')).toBeNull();
    // Without `supporters`, whose campaign pages these are, a campaign's name is plain.
    expect(list.getByRole("link", { name: "Old campaign, from pauseai.info" }).query()).toBeNull();
    // PauseAI's letters lead to their pages under their mailing, for anyone.
    await expect
      .element(list.getByRole("link", { name: staffCopy.mailingPages.theLetter }).last())
      .toHaveAttribute("href", "/staff/mailings/3/letters/12");
  });

  it("gives each ask they've answered a row: the answer first, the ask linked, who asked and when, who set the answer, and the form where staff record it", async () => {
    const { fn, sent } = action();
    const signed = { ...MP.statuses["frontier-ai-letter"], note: "By email" };
    await render(
      <PoliticianDetails
        {...none}
        politician={{ ...MP, statuses: { ...MP.statuses, "frontier-ai-letter": signed } }}
        setStatus={fn}
        unblock={vi.fn()}
      />,
    );
    const row = (slug: string) => page.getByRole("group", { name: ask(slug).title });
    // Those they've answered, in the asks' order; one they haven't isn't there.
    expect(
      page
        .getByRole("region", { name: staffCopy.politician.statusesTitle })
        .getByRole("group")
        .all()
        .map((g) => g.element().getAttribute("aria-label")),
    ).toEqual([ask("edinburgh-conference-2026").title, ask("frontier-ai-letter").title]);
    const letter = row("frontier-ai-letter");
    // Signed, and when, ticked in green.
    const answer = (group: typeof letter) => group.element().querySelector("[class*=answer]")!;
    expect(answer(letter).textContent).toBe(`${staffCopy.statuses.signed}1 Oct 2026${staffCopy.politician.edit}`);
    expect(answer(letter).firstElementChild!.className).toMatch(/yes/);
    // The ask's title leads to its page; who asked it and when.
    await expect
      .element(letter.getByRole("link", { name: ask("frontier-ai-letter").title }))
      .toHaveAttribute("href", "/staff/asks/frontier-ai-letter");
    await expect
      .element(
        letter.getByText(
          staffCopy.politician.askedThem(
            `${staffCopy.asks.askedBy.supporters} and ${staffCopy.asks.askedBy.pauseai}`,
            "letter",
          ),
        ),
      )
      .toBeVisible();
    await expect
      .element(letter.getByText(`By email · ${staffCopy.politician.setBy("jo@pauseai.uk", "2 Oct 2026")}`))
      .toBeVisible();
    // Declined, from Airtable: crossed, not green, and staff can change it.
    const event = row("edinburgh-conference-2026");
    expect(answer(event).firstElementChild!.textContent).toBe(staffCopy.statuses.declined);
    expect(answer(event).firstElementChild!.className).not.toMatch(/yes/);
    await expect.element(event.getByText(staffCopy.politician.fromImport.airtable)).toBeVisible();
    await expect
      .element(
        event.getByText(`${staffCopy.politician.askedThem(staffCopy.asks.askedBy.pauseai, "event")} · 1 Nov 2026`),
      )
      .toBeVisible();
    await expect.element(event.getByRole("button", { name: staffCopy.politician.edit })).toBeVisible();

    // The form, behind Edit: a letter's answers in a row, starting from theirs, and Clear answer set apart.
    expect(letter.getByRole("radiogroup").query()).toBeNull();
    await letter.getByText(staffCopy.politician.edit, { exact: true }).click();
    const choices = letter.getByRole("radiogroup", { name: staffCopy.politician.status });
    await expect
      .element(choices.getByRole("radio", { name: staffCopy.statuses.signed }))
      .toHaveAttribute("aria-checked", "true");
    expect(
      choices
        .getByRole("radio")
        .all()
        .map((r) => r.element().textContent),
    ).toEqual([
      staffCopy.statuses.signed,
      staffCopy.statuses.declined,
      staffCopy.statuses.other,
      staffCopy.politician.clearAnswer,
    ]);
    const clear = choices.getByRole("radio", { name: staffCopy.politician.clearAnswer });
    expect(clear.element().className).toMatch(/quiet/);
    await clear.click();
    await letter.getByLabelText(staffCopy.politician.note).fill("Their office wrote");
    await letter.getByRole("button", { name: staffCopy.politician.save }).click();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ politicianId: "7", ask: "frontier-ai-letter", status: "", note: "Their office wrote" });
  });

  it("shows an answer neither yes nor no plainly, and an ask with no asker or date by its title alone", async () => {
    const bare = { ...ask("go-to-parliament-oct-2026"), askedBy: [], date: null };
    const other = { ...MP.statuses["frontier-ai-letter"], status: "other" as const, date: null };
    await render(
      <PoliticianDetails
        {...none}
        asks={[bare]}
        politician={{ ...MP, statuses: { "go-to-parliament-oct-2026": other } }}
        setStatus={vi.fn()}
        unblock={vi.fn()}
      />,
    );
    const row = page.getByRole("group", { name: bare.title });
    const answer = row.element().querySelector("[class*=answer]")!;
    expect(answer.firstElementChild!.textContent).toBe(staffCopy.statuses.other);
    expect(answer.firstElementChild!.className).not.toMatch(/yes/);
    await expect.element(row.getByRole("link")).toHaveAttribute("href", `/staff/asks/${bare.slug}`);
    await expect.element(row.getByText(staffCopy.politician.askedThem("", "event"), { exact: true })).toBeVisible();
  });

  it("has no row for a letter they haven't answered, and records a decline from Add another answer", async () => {
    const { fn, sent } = action();
    await render(<PoliticianDetails {...none} politician={{ ...MP, statuses: {} }} setStatus={fn} unblock={vi.fn()} />);
    expect(page.getByRole("group", { name: ask("frontier-ai-letter").title }).query()).toBeNull();
    await page.getByRole("button", { name: staffCopy.politician.otherAsk }).click();
    await page
      .getByRole("list", { name: staffCopy.politician.otherAsk })
      .getByRole("button", { name: ask("frontier-ai-letter").title })
      .click();
    const letter = page.getByRole("group", { name: ask("frontier-ai-letter").title });
    await expect.element(letter.getByText(staffCopy.statuses.noAnswer, { exact: true }).first()).toBeVisible();
    // With no answer yet, there's none to clear, and Save waits for one to be picked.
    const choices = letter.getByRole("radiogroup", { name: staffCopy.politician.status });
    expect(
      choices
        .getByRole("radio")
        .all()
        .map((r) => r.element().textContent),
    ).toEqual([staffCopy.statuses.signed, staffCopy.statuses.declined, staffCopy.statuses.other]);
    const save = letter.getByRole("button", { name: staffCopy.politician.save });
    await expect.element(save).toBeDisabled();
    await choices.getByRole("radio", { name: staffCopy.statuses.declined }).click();
    await expect.element(save).toBeEnabled();
    // Not without a note of how they know.
    await save.click();
    expect(sent).toHaveLength(0);
    await letter.getByLabelText(staffCopy.politician.note).fill("They emailed");
    await save.click();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ politicianId: "7", ask: "frontier-ai-letter", status: "declined", note: "They emailed" });
  });

  it("crosses a letter they declined", async () => {
    const declined = { ...MP.statuses["frontier-ai-letter"], status: "declined" as const };
    await render(
      <PoliticianDetails
        {...none}
        politician={{ ...MP, statuses: { "frontier-ai-letter": declined } }}
        setStatus={vi.fn()}
        unblock={vi.fn()}
      />,
    );
    const answer = page
      .getByRole("group", { name: ask("frontier-ai-letter").title })
      .element()
      .querySelector("[class*=answer]")!;
    expect(answer.textContent).toBe(`${staffCopy.statuses.declined}1 Oct 2026${staffCopy.politician.edit}`);
    expect(answer.firstElementChild!.className).toMatch(/no/);
  });

  it("chooses an event's answer from a list, where staff record it", async () => {
    // Wide enough that the form's Save is on screen, whichever tests ran before it.
    await page.viewport(1280, 800);
    // Staff record the letter to the PM; an event made one of its asks, its answer is chosen from a list.
    const event = { ...ask("frontier-ai-letter"), kind: "event" as const, title: "Example Event" };
    const { fn, sent } = action();
    await render(
      <PoliticianDetails
        {...none}
        asks={[event]}
        politician={{ ...MP, statuses: {} }}
        setStatus={fn}
        unblock={vi.fn()}
      />,
    );
    await page.getByRole("button", { name: staffCopy.politician.otherAsk }).click();
    await page.getByRole("button", { name: "Example Event" }).click();
    const row = page.getByRole("group", { name: "Example Event" });
    expect(row.element().querySelector("[class*=answer]")!.textContent).toBe(
      `${staffCopy.statuses.noAnswer}${staffCopy.politician.edit}`,
    );
    expect(row.getByRole("radio", { checked: true }).query()).toBeNull();
    await row.getByRole("radio", { name: staffCopy.statuses.going }).click();
    await row.getByLabelText(staffCopy.politician.note).fill("Their office said");
    await row.getByRole("button", { name: staffCopy.politician.save }).click();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      politicianId: "7",
      ask: "frontier-ai-letter",
      status: "going",
      note: "Their office said",
    });
    // Going: ticked in green, the form starting from their answer.
    await render(
      <PoliticianDetails
        {...none}
        asks={[event]}
        politician={{
          ...MP,
          statuses: { "frontier-ai-letter": { ...MP.statuses["frontier-ai-letter"], status: "going" } },
        }}
        setStatus={fn}
        unblock={vi.fn()}
      />,
    );
    const going = page.getByRole("group", { name: "Example Event" }).last();
    expect(going.element().querySelector("[class*=answer]")!.firstElementChild!.className).toMatch(/yes/);
    expect(going.element().querySelector("[role=radio][aria-checked=true]")!.textContent).toBe(
      staffCopy.statuses.going,
    );
  });

  it("adds another ask staff record from the button under the asks, as a row with no answer and its form open", async () => {
    const dome = { ...ask("frontier-ai-letter"), slug: "giant-pause-button-oct-2026", title: "Giant Pause Button" };
    const fair = { ...dome, slug: "village-fair-nov-2026", title: "Village Fair", kind: "event" as const };
    const { fn, sent } = action();
    const details = (statuses: typeof MP.statuses) => (
      <PoliticianDetails
        {...none}
        asks={[ask("controlai-letter"), dome, fair]}
        politician={{ ...MP, statuses }}
        setStatus={fn}
        unblock={vi.fn()}
      />
    );
    const { rerender } = await render(details({}));
    // Neither has a row yet, and ControlAI's letter, which its import fills, isn't in the menu.
    const asksCard = page.getByRole("region", { name: staffCopy.politician.statusesTitle });
    expect(asksCard.getByRole("group").all()).toHaveLength(0);
    const another = page.getByRole("button", { name: staffCopy.politician.otherAsk });
    const menu = page.getByRole("list", { name: staffCopy.politician.otherAsk });
    await another.click();
    expect(
      menu
        .getByRole("button")
        .all()
        .map((b) => b.element().textContent),
    ).toEqual(["Giant Pause Button", "Village Fair"]);

    // Chosen, it's a row like the others, with no answer, its form open, and gone from the menu.
    await menu.getByRole("button", { name: "Giant Pause Button" }).click();
    await expect.poll(() => menu.query()).toBeNull();
    const row = page.getByRole("group", { name: "Giant Pause Button" });
    expect(row.element().querySelector("[class*=answer]")!.textContent).toBe(
      `${staffCopy.statuses.noAnswer}${staffCopy.politician.edit}`,
    );
    await expect.element(row.getByRole("radiogroup", { name: staffCopy.politician.status })).toBeVisible();
    await row.getByRole("radio", { name: staffCopy.statuses.signed }).click();
    await row.getByLabelText(staffCopy.politician.note).fill("At the march");
    await row.getByRole("button", { name: staffCopy.politician.save }).click();
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      politicianId: "7",
      ask: "giant-pause-button-oct-2026",
      status: "signed",
      note: "At the march",
    });

    // Signed, the page has it as a row of its own, and the menu only the other; with that added, there's no button.
    await rerender(details({ "giant-pause-button-oct-2026": MP.statuses["frontier-ai-letter"] }));
    await expect.element(page.getByRole("group", { name: "Giant Pause Button" })).toBeVisible();
    await another.click();
    expect(
      menu
        .getByRole("button")
        .all()
        .map((b) => b.element().textContent),
    ).toEqual(["Village Fair"]);
    await menu.getByRole("button", { name: "Village Fair" }).click();
    await expect.element(page.getByRole("group", { name: "Village Fair" })).toBeVisible();
    expect(another.query()).toBeNull();

    // Its answer cleared, it has no row, and it's back in the menu.
    await rerender(details({}));
    await expect.element(page.getByRole("group", { name: "Giant Pause Button" })).not.toBeInTheDocument();
    await expect.element(another).toBeVisible();
    expect(
      [...document.querySelectorAll(`ul[aria-label="${staffCopy.politician.otherAsk}"] button`)].map(
        (b) => b.textContent,
      ),
    ).toEqual(["Giant Pause Button"]);
  });

  it("puts an ask added from the menu in its place among the rows, scrolled to, and takes it away closed unanswered", async () => {
    const dome = { ...ask("frontier-ai-letter"), slug: "giant-pause-button-oct-2026", title: "Giant Pause Button" };
    const fair = { ...dome, slug: "village-fair-nov-2026", title: "Village Fair", kind: "event" as const };
    const going = { ...MP.statuses["frontier-ai-letter"], status: "going" as const };
    // A window too short for the bubble under the row, so it's scrolled to.
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(0);
    const scrolled = vi.spyOn(window, "scrollBy");
    await render(
      <PoliticianDetails
        {...none}
        asks={[dome, fair]}
        politician={{ ...MP, statuses: { "village-fair-nov-2026": going } }}
        setStatus={vi.fn()}
        unblock={vi.fn()}
      />,
    );
    const titles = () => [...document.querySelectorAll("[role=group]")].map((g) => g.getAttribute("aria-label"));
    expect(titles()).toEqual(["Village Fair"]);
    const another = page.getByRole("button", { name: staffCopy.politician.otherAsk });
    await another.click();
    await page.getByRole("button", { name: "Giant Pause Button" }).click();
    // The asks' order, not the order they were added in.
    expect(titles()).toEqual(["Giant Pause Button", "Village Fair"]);
    expect(scrolled).toHaveBeenCalledOnce();
    vi.restoreAllMocks();

    // Its bubble closed with no answer saved, the row goes and the ask is back in the menu.
    await expect.element(page.getByRole("radiogroup", { name: staffCopy.politician.status })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(titles()).toEqual(["Village Fair"]));
    await another.click();
    await expect
      .element(page.getByRole("list", { name: staffCopy.politician.otherAsk }).getByRole("button"))
      .toHaveTextContent("Giant Pause Button");
  });

  it("says in one place that letters aren't being sent, why, what to check, and unblocks it with a note", async () => {
    const { fn, sent } = action();
    const { rerender } = await render(
      <PoliticianDetails
        politician={{ ...MP, emailBlocked: true }}
        block={{ ...exampleBlock, address: MP.email! }}
        unblock={fn}
        {...none}
      />,
    );
    const copy = staffCopy.politician.blocked;
    expect(page.getByRole("heading", { level: 1 }).element().textContent).toBe(MP.name);
    const notice = page.getByRole("region", { name: copy.title });
    // A red strip: the warning icon at the left, the rest beside it.
    const strip = notice.element().firstElementChild!;
    expect(strip.firstElementChild!.tagName.toLowerCase()).toBe("svg");
    expect(strip.className).toMatch(/red/);
    // An MP's address is their body's, so the only choice here is that it's right.
    expect([...notice.element().querySelectorAll("h3")].map((h) => h.textContent)).toEqual([copy.right.title]);
    expect(notice.element().querySelector("p")!.textContent).toBe(
      `${copy.why.before}${MP.email}${copy.why.after(exampleBlock.reason, "12 Oct 2026, 09:10")}`,
    );
    expect(notice.element().querySelector("p strong")!.textContent).toBe(MP.email);
    // The example's reason ends in a full stop, so the sentence doesn't add a second.
    expect(notice.element().querySelector("p")!.textContent).not.toContain("..");
    // The address is a link to write to it in the band, and under it in bold in the strip.
    expect(
      page
        .getByText(MP.email!, { exact: true })
        .all()
        .map((el) => el.element().tagName),
    ).toEqual(["A", "STRONG"]);
    await page.getByLabelText(staffCopy.emails.note).fill("Fixed in Airtable");
    await page.getByRole("button", { name: staffCopy.emails.unblock }).click();
    await vi.waitFor(() => expect(sent).toEqual([{ address: MP.email, note: "Fixed in Airtable" }]));

    // An MP's address is their body's, so there's nowhere to correct it here; a Lord's is staff's, in Writing to them.
    expect(notice.element().textContent).not.toContain(copy.wrong.before);
    await rerender(
      <PoliticianDetails
        politician={{ ...MP, house: "lords", emailBlocked: true }}
        block={{ ...exampleBlock, address: MP.email! }}
        unblock={fn}
        editDetails={vi.fn()}
        {...none}
      />,
    );
    // A Lord's: their two choices side by side, the address wrong, corrected in Writing to them, or right.
    expect([...notice.element().querySelectorAll("h3")].map((h) => h.textContent)).toEqual([
      copy.wrong.title,
      copy.right.title,
    ]);
    await expect
      .element(notice.getByRole("link", { name: copy.wrong.link }))
      .toHaveAttribute("href", `/staff/politicians/${MP.id}?aliases=open`);

    // A complaint can't be unblocked here: no advice on fixing it, and no form.
    await rerender(
      <PoliticianDetails
        politician={{ ...MP, emailBlocked: true }}
        block={{ ...exampleBlock, address: MP.email!, canReset: false }}
        unblock={fn}
        {...none}
      />,
    );
    expect(notice.element().textContent).not.toContain(copy.wrong.before);
    await expect.element(notice.getByText(staffCopy.emails.cantReset)).toBeVisible();
  });

  it("opens their other addresses from their email in the band, with a Remove by those staff can take off, the newest added last", async () => {
    const remove = action();
    const add = vi.fn(async () => ({ added: true as const }));
    const aliases = { add, remove: remove.fn };
    const words = staffCopy.politician.aliases;
    const details = (props: Partial<Parameters<typeof PoliticianDetails>[0]> = {}) => (
      <PoliticianDetails
        politician={MP}
        unblock={vi.fn()}
        {...none}
        aliases={exampleAliases}
        aliasActions={aliases}
        {...props}
      />
    );
    const { rerender } = await render(details());
    const more = page.getByRole("button", { name: words.more(7) });
    await expect.element(more).toBeVisible();
    await more.click();
    const bubble = document.querySelector("[popover]:popover-open")!;
    const rows = () =>
      [...bubble.querySelectorAll("li")].map((row) => row.querySelector(":scope > span")!.firstChild!.textContent);
    expect(rows()).toEqual([
      "polly@oldexample.org.uk",
      "placeholderp@parliament.uk",
      "jane.smith@parliament.uk",
      "@pollyplaceholder.org.uk",
      "polly.placeholder.mp@parliament.uk",
      "citiesoflondonandwestminster.mp@parliament.uk",
      "polly.placeholder@example.com",
    ]);
    await expect
      .element(page.getByText(words.addedBy("jo@pauseai.uk", staffDate(exampleAliases.added[0].at))))
      .toBeVisible();
    const removes = page.getByRole("button", { name: words.remove });
    await removes.nth(0).click();
    await removes.nth(1).click();
    await vi.waitFor(() =>
      expect(remove.sent).toEqual([
        { politicianId: String(MP.id), address: "jane.smith@parliament.uk" },
        { politicianId: String(MP.id), address: "polly.placeholder@example.com" },
      ]),
    );
    // One just added comes last, and pulses once to draw the eye.
    await page.getByLabelText(words.address).fill("Polly.New@example.com");
    await page.getByRole("button", { name: words.add }).click();
    await vi.waitFor(() => expect(add).toHaveBeenCalledOnce());
    const later = new Date(exampleAliases.added[0].at.getTime() + 60_000);
    await rerender(
      details({
        aliases: {
          ...exampleAliases,
          added: [{ address: "polly.new@example.com", addedBy: "jo@pauseai.uk", at: later }, ...exampleAliases.added],
        },
      }),
    );
    const newest = [...bubble.querySelectorAll("li")].at(-1)!;
    expect(newest.textContent).toContain("polly.new@example.com");
    expect(newest.hasAttribute("data-pulse")).toBe(true);
    // Led here, as from the blocked address's strip, it opens at once.
    await rerender(<div />);
    await rerender(details({ aliasesOpen: true }));
    expect(document.querySelector("[popover]:popover-open")).not.toBeNull();
    // With no email, nothing to list or add, but for a Lord their email to set.
    await rerender(details({ politician: { ...MP, email: null }, aliases: { ...exampleAliases, email: null } }));
    await expect.element(page.getByRole("button", { name: words.add })).not.toBeInTheDocument();
    // Without what changes them, the email alone.
    await rerender(<PoliticianDetails politician={MP} unblock={vi.fn()} {...none} aliases={exampleAliases} />);
    expect(page.getByRole("button", { name: words.more(7) }).query()).toBeNull();
  });
});

describe("AddAliasForm", () => {
  const words = staffCopy.politician.aliases;

  it("sends the address, and says what happened", async () => {
    const results = [
      { added: true as const },
      { added: false as const, why: "invalid" as const },
      { added: false as const, why: "exists" as const },
      undefined,
    ];
    const sent: string[] = [];
    await render(
      <AddAliasForm
        politicianId={7}
        action={(form) => {
          sent.push(`${String(form.get("politicianId"))} ${String(form.get("address"))}`);
          return results.shift();
        }}
      />,
    );
    const status = page.getByRole("status");
    const send = async (address: string) => {
      await page.getByLabelText(words.address).fill(address);
      await page.getByRole("button", { name: words.add }).click();
    };
    await send("a@example.com");
    await expect.element(status).toHaveTextContent(words.added);
    await send("b@example.com");
    await expect.element(status).toHaveTextContent(words.refused.invalid);
    await send("c@example.com");
    await expect.element(status).toHaveTextContent(words.refused.exists);
    await send("d@example.com");
    await expect.element(status).toHaveTextContent("");
    expect(sent).toEqual(["7 a@example.com", "7 b@example.com", "7 c@example.com", "7 d@example.com"]);
  });
});
