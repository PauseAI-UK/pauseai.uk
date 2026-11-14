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
        label: "All, and complaints to a search",
        render: () => (
          <StaffPage as="div">
            <EmailBlockFilters q="" kind="" action="/staff/politicians/addresses-to-fix" />
            <EmailBlockFilters q="example.org" kind="complaint" action="/staff/politicians/addresses-to-fix" />
          </StaffPage>
        ),
      },
    ],
  },
];
