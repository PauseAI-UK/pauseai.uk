// Shortened in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Shortened, { cutAtWord } from "./Shortened";
import StaffPage from "./StaffPage";
import Tag from "@/components/ui/Tag";

const EXAMPLE_SUBJECT = "Please make the Millennium Dome into a giant pause button";

export const shortenedGallery: Example[] = [
  {
    name: "Shortened",
    file: "app/(staff)/staff/_components/ui/Shortened.tsx",
    variants: [
      {
        label: "A long subject cut at a word, and one with a lozenge after it; the … unfolds each",
        render: () => (
          <StaffPage as="div">
            <div style={{ display: "grid", gap: "8px", maxWidth: "24rem" }}>
              <div>
                <Shortened short={cutAtWord(EXAMPLE_SUBJECT, 40)!} whole={EXAMPLE_SUBJECT} />
              </div>
              <div>
                <Shortened
                  short="The address does not exist."
                  whole="The address does not exist. Please check it for typos."
                >
                  <Tag>Gmail</Tag>
                </Shortened>
              </div>
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
