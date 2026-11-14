// Band in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Band, { BandFact, Facts } from "./Band";
import Counts from "./Counts";
import StaffPage from "./StaffPage";
import Tag from "@/components/ui/Tag";

export const bandGallery: Example[] = [
  {
    name: "Band",
    file: "app/(staff)/staff/_components/ui/Band.tsx",
    variants: [
      {
        label: "A title with a tag, three facts, two with a line under them, and counts at the right",
        render: () => (
          <StaffPage as="div">
            <Band
              title="Please make the Millennium Dome into a giant pause button"
              tag={<Tag>Sent</Tag>}
              aside={
                <Counts
                  counts={[
                    { key: "sent", n: 84, label: "sent" },
                    { key: "failed", n: 3, label: "failed", tone: "red" },
                  ]}
                />
              }
            >
              <BandFact label="Sent" detail="by francis@pauseai.uk">
                29 Oct 2026, 14:18
              </BandFact>
              <BandFact label="From" detail="Francis, PauseAI UK">
                policy@pauseai.uk
              </BandFact>
              <BandFact label="Ask">
                <a href="#">Giant pause button funding request</a>
              </BandFact>
            </Band>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "BandFact",
    file: "app/(staff)/staff/_components/ui/Band.tsx",
    variants: [
      {
        label: "A fact in a band, and one with no value, which shows nothing",
        render: () => (
          <StaffPage as="div">
            <Band title="A supporter">
              <BandFact label="Place" detail="from their postcode, M1 1AE">
                Manchester, England
              </BandFact>
              <BandFact label="Their MP">{null}</BandFact>
            </Band>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "Facts",
    file: "app/(staff)/staff/_components/ui/Band.tsx",
    variants: [
      {
        label: "Facts on their own, in a card, as a broadcast's Send step lists what will go",
        render: () => (
          <StaffPage as="div">
            <Facts>
              <BandFact label="Sends">412 emails</BandFact>
              <BandFact label="From" detail="by email">
                PauseAI UK &lt;hello@pauseai.uk&gt;
              </BandFact>
              <BandFact label="When">Fri 16 Oct at 14:18</BandFact>
            </Facts>
          </StaffPage>
        ),
      },
    ],
  },
];
