// EmailBlockFilters in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import EmailBlockFilters from "./EmailBlockFilters";
import StaffPage from "../ui/StaffPage";

export const emailBlockFiltersGallery: Example[] = [
  {
    name: "EmailBlockFilters",
    file: "app/(staff)/staff/_components/email/EmailBlockFilters.tsx",
    variants: [
      {
        label: "Politicians': all, and complaints found by a letter to a search",
        render: () => (
          <StaffPage as="div">
            <EmailBlockFilters q="" kind="" found="" numbers={false} action="/staff/politicians/addresses-to-fix" />
            <EmailBlockFilters
              q="example.org"
              kind="complaint"
              found="letter"
              numbers={false}
              action="/staff/politicians/addresses-to-fix"
            />
          </StaffPage>
        ),
      },
      {
        label: "Supporters': numbers not on WhatsApp",
        render: () => (
          <StaffPage as="div">
            <EmailBlockFilters q="" kind="not-on-whatsapp" found="" numbers action="/staff/supporters/bounced-emails" />
          </StaffPage>
        ),
      },
    ],
  },
];
