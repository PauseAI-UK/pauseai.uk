// CopyCounts in the component gallery (app/(tools)/gallery/), in the staff mailings and events group
// (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { wentAndGone } from "../letters/CopyStatus";
import { CountGroups, NeedsAndFine } from "./CopyCounts";
import { countsOpening } from "../ui/Counts";
import { mailingCounts } from "./MailingsOverview";
import { exampleMailings } from "./MailingsTable.examples";

/** The Edinburgh invitation: some sent, replied and answered, and two that didn't reach anyone. */
const sent = exampleMailings[0];

export const copyCountsGallery: Example[] = [
  {
    name: "CountGroups",
    file: "app/(staff)/staff/_components/mailings/CopyCounts.tsx",
    variants: [
      {
        label: "A mailing's counts, those that went and those that didn't, each under its total",
        render: () => <CountGroups groups={wentAndGone(countsOpening("/staff/mailings/4", mailingCounts(sent)))} />,
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
            <NeedsAndFine counts={countsOpening("/staff/mailings/4", mailingCounts(sent))} />
            <NeedsAndFine
              counts={countsOpening(
                "/staff/mailings/7",
                mailingCounts({ ...sent, id: 7, states: { ...sent.states, unreached: 0 } }),
              )}
            />
          </div>
        ),
      },
    ],
  },
];
