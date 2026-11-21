// The weekly briefings' kit (components/briefings/): the briefing whole, its
// card in the list, and the pieces a briefing is written with, each on a
// sheet, as a briefing would have it.
import type { ReactNode } from "react";
import Briefing from "@/components/briefings/Briefing";
import BriefingBox from "@/components/briefings/BriefingBox";
import BriefingCard from "@/components/briefings/BriefingCard";
import BriefingColumns from "@/components/briefings/BriefingColumns";
import BriefingFigure from "@/components/briefings/BriefingFigure";
import BriefingFlags from "@/components/briefings/BriefingFlags";
import BriefingInset from "@/components/briefings/BriefingInset";
import BriefingList from "@/components/briefings/BriefingList";
import BriefingMasthead from "@/components/briefings/BriefingMasthead";
import BriefingPicture from "@/components/briefings/BriefingPicture";
import BriefingQuote from "@/components/briefings/BriefingQuote";
import BriefingSheet from "@/components/briefings/BriefingSheet";
import BriefingSources from "@/components/briefings/BriefingSources";
import { Accent, Aside, ColumnList, Flag, Subhead } from "@/components/briefings/BriefingText";
import BudgetChart from "@/components/briefings/BudgetChart";
import CommitmentsTable from "@/components/briefings/CommitmentsTable";
import KeyStories from "@/components/briefings/KeyStories";
import SignatoriesChart from "@/components/briefings/SignatoriesChart";
import WeekCalendar from "@/components/briefings/WeekCalendar";
import type { BriefingTone } from "@/components/briefings/tone";
import { BRIEFINGS, briefings } from "@/lib/content/briefings";
import type { Group } from "../_components/types";

const BRIEFING = briefings[0];

/** On a sheet, in a page's width, as a briefing's pieces always are. */
const onSheet = (children: ReactNode) => (
  <div className="container">
    <BriefingSheet as="div">{children}</BriefingSheet>
  </div>
);

// Every tone, so a new one is a type error until it's here.
const TONES: Record<BriefingTone, string> = {
  headline: "Key stories this week",
  parliament: "In Westminster this week",
  industry: "Anthropic’s IPO filing",
  international: "International Cooperation",
  risk: "A risk",
  good: "Good news!",
  diary: "Next week key dates",
};

const STORIES = [
  { lead: "Monday: a company files to go public.", body: "It filed to list on the US stock market." },
  { lead: "Wednesday: a budget.", body: "Most of it goes on AI security." },
];

export const briefingsKit: Group = {
  id: "briefings",
  title: "Weekly briefings",
  examples: [
    {
      name: "Briefing",
      file: "components/briefings/Briefing.tsx",
      variants: [{ label: "A briefing, whole", render: () => <Briefing briefing={BRIEFING} section={BRIEFINGS} /> }],
    },
    {
      name: "BriefingList",
      file: "components/briefings/BriefingList.tsx",
      variants: [
        {
          label: "Two briefings",
          render: () => (
            <BriefingList
              briefings={[BRIEFING, { ...BRIEFING, slug: "an-earlier-briefing", title: "An earlier briefing" }]}
              section={BRIEFINGS}
            />
          ),
        },
      ],
    },
    {
      name: "BriefingCard",
      file: "components/briefings/BriefingCard.tsx",
      variants: [
        {
          label: "Its masthead and the key stories' headlines",
          render: () => (
            <div className="container">
              <BriefingCard briefing={BRIEFING} section={BRIEFINGS} />
            </div>
          ),
        },
      ],
    },
    {
      name: "BriefingSheet",
      file: "components/briefings/BriefingSheet.tsx",
      variants: [
        {
          label: "Paragraphs, a list and a source's mark",
          render: () =>
            onSheet(
              <>
                <p>
                  A paragraph citing a source.
                  <sup>
                    <a href="#source-1">1</a>
                  </sup>
                </p>
                <ul>
                  <li>One thing</li>
                  <li>Another</li>
                </ul>
              </>,
            ),
        },
      ],
    },
    {
      name: "BriefingMasthead",
      file: "components/briefings/BriefingMasthead.tsx",
      variants: [
        {
          label: "On the briefing's page",
          render: () => onSheet(<BriefingMasthead briefing={BRIEFING} />),
        },
        {
          label: "On a card, nothing linked",
          render: () => onSheet(<BriefingMasthead briefing={BRIEFING} card />),
        },
      ],
    },
    {
      name: "BriefingBox",
      file: "components/briefings/BriefingBox.tsx",
      variants: [
        {
          label: "Every tone, a list's markers in it",
          render: () =>
            onSheet(
              (Object.keys(TONES) as BriefingTone[]).map((tone) => (
                <BriefingBox key={tone} title={TONES[tone]} tone={tone}>
                  <ul>
                    <li>A story in this box.</li>
                  </ul>
                </BriefingBox>
              )),
            ),
        },
      ],
    },
    {
      name: "KeyStories",
      file: "components/briefings/KeyStories.tsx",
      variants: [
        {
          label: "Whole",
          render: () =>
            onSheet(
              <BriefingBox title="Key stories this week" tone="headline">
                <KeyStories stories={STORIES} />
              </BriefingBox>,
            ),
        },
        {
          label: "Headlines alone",
          render: () =>
            onSheet(
              <BriefingBox title="Key stories this week" tone="headline">
                <KeyStories stories={STORIES} leads />
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "BriefingColumns",
      file: "components/briefings/BriefingColumns.tsx",
      variants: [
        {
          label: "Text and a quote aside; two even quotes; text and a figure",
          render: () =>
            onSheet(
              <BriefingBox title="Columns" tone="parliament">
                <BriefingColumns layout="aside">
                  <p>Some text, the wider column, with a pull quote beside it.</p>
                  <BriefingQuote who="Jane Smith" size="large">
                    “A pull quote.”
                  </BriefingQuote>
                </BriefingColumns>
                <BriefingColumns layout="even">
                  <BriefingQuote who="- Jane Smith" size="small">
                    “One quote, beside another.”
                  </BriefingQuote>
                  <BriefingQuote who="- John Smith" size="small">
                    “The other quote.”
                  </BriefingQuote>
                </BriefingColumns>
                <BriefingColumns layout="figure">
                  <p>Text beside a figure, the two centred on each other.</p>
                  <p>
                    <Flag>A FIGURE</Flag>
                  </p>
                </BriefingColumns>
              </BriefingBox>,
            ),
        },
        {
          label: "A pair of boxes, as tall as each other",
          render: () =>
            onSheet(
              <BriefingColumns layout="pair">
                <BriefingBox title="Good news!" tone="good">
                  <p>A short box.</p>
                </BriefingBox>
                <BriefingBox title="Next week key dates" tone="diary">
                  <p>A longer box, a little wider, with more in it.</p>
                  <p>More.</p>
                  <p>And more.</p>
                </BriefingBox>
              </BriefingColumns>,
            ),
        },
      ],
    },
    {
      name: "BriefingQuote",
      file: "components/briefings/BriefingQuote.tsx",
      variants: (["small", "medium", "large"] as const).map((size) => ({
        label: size,
        render: () =>
          onSheet(
            <BriefingBox title="Quotes" tone="industry">
              <BriefingQuote who="Jane Smith, a speech" size={size}>
                “Words someone said, quoted in the briefing.”
              </BriefingQuote>
            </BriefingBox>,
          ),
      })),
    },
    {
      name: "Accent",
      file: "components/briefings/BriefingText.tsx",
      variants: [
        {
          label: "Starting a story's heading, which is flagged",
          render: () =>
            onSheet(
              <BriefingBox title="In Westminster this week" tone="parliament">
                <h3>
                  <Accent>Mon 2 Nov - Commons -</Accent> A debate - <Flag>POSTPONED</Flag>
                </h3>
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "Flag",
      file: "components/briefings/BriefingText.tsx",
      variants: [
        {
          label: "A word flagged",
          render: () =>
            onSheet(
              <p>
                A debate <Flag>POSTPONED</Flag>
              </p>,
            ),
        },
      ],
    },
    {
      name: "Subhead",
      file: "components/briefings/BriefingText.tsx",
      variants: [
        {
          label: "Over a list",
          render: () =>
            onSheet(
              <BriefingBox title="In Westminster this week" tone="parliament">
                <Subhead>What changed on Monday? Now …</Subhead>
                <ul>
                  <li>One change.</li>
                </ul>
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "ColumnList",
      file: "components/briefings/BriefingText.tsx",
      variants: [
        {
          label: "Short items in two columns",
          render: () =>
            onSheet(
              <BriefingBox title="International & cooperation" tone="international">
                <Subhead>The report calls for:</Subhead>
                <ColumnList>
                  <li>emergency shutdown authority</li>
                  <li>mandatory third-party oversight & inspections</li>
                  <li>baseline standards for all developers</li>
                  <li>a cap on recursive self improvement</li>
                </ColumnList>
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "Aside",
      file: "components/briefings/BriefingText.tsx",
      variants: [
        {
          label: "After a list",
          render: () =>
            onSheet(
              <BriefingBox title="Next week key dates" tone="diary">
                <ul>
                  <li>
                    <strong>2 Nov:</strong> Something happens.
                  </li>
                </ul>
                <Aside>
                  <strong>Further ahead · Fri 13 Nov</strong> Something later.
                </Aside>
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "BriefingPicture",
      file: "components/briefings/BriefingPicture.tsx",
      variants: [
        {
          label: "At the bottom right of a box",
          render: () =>
            onSheet(
              <BriefingBox title="Good news!" tone="good">
                <p>Some good news.</p>
                <BriefingPicture
                  src="/images/briefings/chest-x-ray.svg"
                  alt="A pencil drawing of a chest X-ray"
                  width={300}
                  height={320}
                />
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "BriefingFigure",
      file: "components/briefings/BriefingFigure.tsx",
      variants: [
        {
          label: "A diagram across a box",
          render: () =>
            onSheet(
              <BriefingBox title="Risks, incidents & security" tone="risk">
                <p>A story the diagram explains.</p>
                <BriefingFigure
                  src="/images/briefings/nvidia-chip-network.png"
                  alt="A diagram of a network of companies"
                  width={2048}
                  height={753}
                  cite={
                    <sup>
                      <a href="#source-1">1</a>
                    </sup>
                  }
                />
              </BriefingBox>,
            ),
        },
        {
          label: "A narrow diagram beside the text",
          render: () =>
            onSheet(
              <BriefingBox title="This week in Westminster" tone="parliament">
                <BriefingColumns layout="figure">
                  <p>A story the diagram beside it explains.</p>
                  <BriefingFigure
                    src="/images/briefings/regulator-at-every-stage.png"
                    alt="A diagram of a regulator acting at each stage of a model's life"
                    width={1140}
                    height={978}
                    cite={
                      <sup>
                        <a href="#source-1">1</a>
                      </sup>
                    }
                    beside
                  />
                </BriefingColumns>
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "BriefingFlags",
      file: "components/briefings/BriefingFlags.tsx",
      variants: [
        {
          label: "Under a story's heading",
          render: () =>
            onSheet(
              <BriefingBox title="International & Cooperation" tone="international">
                <h3>Mon 9th Nov - A joint statement</h3>
                <BriefingFlags
                  countries={[
                    { code: "fr", name: "France" },
                    { code: "ca", name: "Canada" },
                    { code: "gb", name: "United Kingdom" },
                  ]}
                />
                <p>Three governments agree on something.</p>
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "BriefingInset",
      file: "components/briefings/BriefingInset.tsx",
      variants: [
        {
          label: "A story set apart",
          render: () =>
            onSheet(
              <BriefingBox title="International & Cooperation" tone="international">
                <p>The box’s main story.</p>
                <BriefingInset>
                  <h3>Thurs 12th Nov - A story apart</h3>
                  <p>Something else that happened.</p>
                </BriefingInset>
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "CommitmentsTable",
      file: "components/briefings/CommitmentsTable.tsx",
      variants: [
        {
          label: "Three texts",
          render: () =>
            onSheet(
              <BriefingBox title="International & Cooperation" tone="international">
                <CommitmentsTable
                  label="What each text covers"
                  texts={[
                    { name: "A call", date: "9 Nov", verdict: { label: "UK: NOT SIGNED", tone: "risk", dashed: true } },
                    { name: "A law", date: "10 Nov", verdict: { label: "NATIONAL LAW", tone: "diary" } },
                    { name: "A statement", date: "12 Nov", verdict: { label: "UK: SIGNED", tone: "good" } },
                  ]}
                  rows={[
                    { name: "Incident reporting", commitments: ["yes", "yes", "part"] },
                    { name: "Shutdown mechanisms", commitments: ["yes", "no", "no"] },
                  ]}
                  meanings={{ yes: "in the text", part: "in part", no: "not in the text" }}
                  caption="Tick: in the text · half: in part · dash: not in the text"
                  cite={
                    <sup>
                      <a href="#source-1">1</a>
                    </sup>
                  }
                />
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "BriefingSources",
      file: "components/briefings/BriefingSources.tsx",
      variants: [
        {
          label: "Two sources",
          render: () =>
            onSheet(
              <BriefingSources>
                <li id="source-1">
                  A. Author (2026) <em>A report</em>. Available at:{" "}
                  <a href="https://example.com/a-report" target="_blank" rel="noreferrer">
                    https://example.com/a-report
                  </a>
                </li>
                <li id="source-2">B. Author (2026) An article, 1 November.</li>
              </BriefingSources>,
            ),
        },
      ],
    },
    {
      name: "BudgetChart",
      file: "components/briefings/BudgetChart.tsx",
      variants: [
        {
          label: "Groups of items, each its topic's colour and its own hatching",
          render: () =>
            onSheet(
              <BriefingBox title="Budget Breakdown" tone="parliament">
                <BudgetChart
                  totalLabel="£300m in total"
                  purposeHeading="What it’s for"
                  caption="£ millions."
                  groups={[
                    {
                      name: "Security",
                      tone: "risk",
                      items: [
                        { name: "A testing lab", amount: 120, purpose: "Tests frontier AI for dangers" },
                        { name: "A cyber unit ★", amount: 40, purpose: "Watches for rogue AI agents" },
                      ],
                    },
                    {
                      name: "Industry",
                      tone: "industry",
                      items: [{ name: "A sovereign fund", amount: 90, purpose: "Invests in British AI firms" }],
                    },
                    {
                      name: "Jobs",
                      tone: "good",
                      items: [{ name: "A research programme", amount: 50, purpose: "Tracks how AI reshapes work" }],
                    },
                  ]}
                />
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "SignatoriesChart",
      file: "components/briefings/SignatoriesChart.tsx",
      variants: [
        {
          label: "Two counts, a meeting after them, and who hasn't signed",
          render: () =>
            onSheet(
              <BriefingBox title="International Cooperation" tone="international">
                <BriefingColumns layout="figure">
                  <p>Text beside the chart.</p>
                  <SignatoriesChart
                    title="Countries backing a call"
                    counts={[
                      { value: 12, date: "1 Sep", note: "launch" },
                      { value: 20, date: "1 Oct", note: "latest" },
                    ]}
                    event={{ date: "8 Oct meeting", note: "18 countries" }}
                    callout="UK: NOT SIGNED"
                    cite={<sup>1</sup>}
                  />
                </BriefingColumns>
              </BriefingBox>,
            ),
        },
      ],
    },
    {
      name: "WeekCalendar",
      file: "components/briefings/WeekCalendar.tsx",
      variants: [
        {
          label: "A week, some days busy, each event in its topic's colour",
          render: () =>
            onSheet(
              <WeekCalendar
                days={[
                  {
                    date: "2026-11-02",
                    events: [
                      { what: "Lords 3rd reading", tone: "parliament" },
                      { what: "A summit", tone: "industry" },
                    ],
                  },
                  { date: "2026-11-03", events: [{ what: "An election", tone: "international" }] },
                  { date: "2026-11-04", events: [] },
                  { date: "2026-11-05", events: [{ what: "A consultation closes", tone: "parliament" }] },
                  { date: "2026-11-06", events: [] },
                ]}
              />,
            ),
        },
      ],
    },
  ],
};
