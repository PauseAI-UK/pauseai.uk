// LetterView in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MailingLetterViewExample, SupporterLetterViewExample } from "./LetterView.gallery.client";

export const letterViewGallery: Example[] = [
  {
    name: "LetterView",
    file: "app/(staff)/staff/_components/letters/LetterView.tsx",
    variants: [
      {
        label: "A mailing's letter and its reply, beside the ask, as a politician's page has it, and its history",
        render: () => (
          <StaffPage as="div">
            <MailingLetterViewExample />
          </StaffPage>
        ),
      },
      {
        label: "A supporter's letter to a test MP that bounced, beside its campaign's ask, not yet answered",
        render: () => (
          <StaffPage as="div">
            <SupporterLetterViewExample ask />
          </StaffPage>
        ),
      },
      {
        label: "One whose campaign makes no ask: the campaign alone",
        render: () => (
          <StaffPage as="div">
            <SupporterLetterViewExample ask={false} />
          </StaffPage>
        ),
      },
    ],
  },
];
