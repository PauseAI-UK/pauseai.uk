// ThreadText in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ThreadText from "./ThreadText";
import StaffPage from "../ui/StaffPage";

export const threadTextGallery: Example[] = [
  {
    name: "ThreadText",
    file: "app/(staff)/staff/_components/letters/ThreadText.tsx",
    variants: [
      {
        label: "An email's plain text, with bold and a link",
        render: () => (
          <StaffPage as="div">
            <ThreadText text={"Dear Jane,\n\n*Our letter is out: https://example.org/letter*\n\nKind regards"} />
          </StaffPage>
        ),
      },
      {
        label: "With a list, a nested numbered list, a quote within a quote, and Outlook's rule",
        render: () => (
          <StaffPage as="div">
            <div style={{ whiteSpace: "pre-wrap" }}>
              <ThreadText
                text={
                  "Dear Jane,\n\nThe motion asks for:\n- a summit\n  1. this year\n  2. with China\n- a treaty\n\n" +
                  "Kind regards,\nSam\n\nOn Mon, Jane wrote:\n> Will you sign?\n>\n> > Please do.\n" +
                  `${"_".repeat(32)}\nFrom: Jo\nSent: Monday`
                }
              />
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
