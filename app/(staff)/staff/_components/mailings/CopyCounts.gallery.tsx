// CopyCounts in the component gallery (app/(tools)/gallery/), in the staff broadcasts group
// (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { broadcastCounts } from "../BroadcastView";
import { wentAndGone } from "../letters/CopyStatus";
import { CountGroups, NeedsAndFine } from "./CopyCounts";
import { countsOpening } from "../ui/Counts";
import { exampleBroadcastSummary } from "../BroadcastWriter.examples";

/** A text that went to 61: most arrived, some read and replied, one to check, two opted out, and some that didn't go. */
const EXAMPLE_TEXT_SUMMARY = {
  ...exampleBroadcastSummary,
  channel: "text" as const,
  states: {
    sent: 3,
    delivered: 21,
    read: 25,
    replied: 3,
    look: 1,
    "opted-out": 2,
    error: 1,
    unreached: 2,
    "not-sent": 6,
  },
};

export const copyCountsGallery: Example[] = [
  {
    name: "CountGroups",
    file: "app/(staff)/staff/_components/mailings/CopyCounts.tsx",
    variants: [
      {
        label: "A text's counts, those that went and those that didn't, each under its total",
        render: () => (
          <CountGroups
            groups={wentAndGone(countsOpening("/staff/broadcasts/5", broadcastCounts(EXAMPLE_TEXT_SUMMARY)))}
          />
        ),
      },
    ],
  },
  {
    name: "NeedsAndFine",
    file: "app/(staff)/staff/_components/mailings/CopyCounts.tsx",
    variants: [
      {
        label: "What needs a look, then the rest folded behind how many are fine; and one with nothing to look at",
        render: () => (
          <div style={{ display: "grid", gap: "1rem", justifyItems: "end" }}>
            <NeedsAndFine counts={countsOpening("/staff/broadcasts/5", broadcastCounts(EXAMPLE_TEXT_SUMMARY))} />
            <NeedsAndFine
              counts={countsOpening(
                "/staff/broadcasts/6",
                broadcastCounts({
                  ...EXAMPLE_TEXT_SUMMARY,
                  states: { ...EXAMPLE_TEXT_SUMMARY.states, look: 0, "opted-out": 0, error: 0, unreached: 0 },
                }),
              )}
            />
          </div>
        ),
      },
    ],
  },
];
