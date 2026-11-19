// EmailBlockFilters in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { ADDRESSES_TO_FIX_LIST, BLOCKED_ADDRESSES_LIST } from "@/lib/staff-lists";
import EmailBlockFilters from "./EmailBlockFilters";
import StaffPage from "../ui/StaffPage";

const politicians = ADDRESSES_TO_FIX_LIST;

export const emailBlockFiltersGallery: Example[] = [
  {
    name: "EmailBlockFilters",
    file: "app/(staff)/staff/_components/email/EmailBlockFilters.tsx",
    variants: [
      {
        label: "Politicians': all, and complaints Gmail told us of, found by a letter, to a search",
        render: () => (
          <StaffPage as="div">
            <EmailBlockFilters search={politicians.read({})} numbers={false} action={politicians.path} />
            <EmailBlockFilters
              search={politicians.read({ q: "example.org", kind: "complaint", backend: "gmail", found: "letter" })}
              numbers={false}
              action={politicians.path}
            />
          </StaffPage>
        ),
      },
      {
        label: "Supporters': numbers not on WhatsApp",
        render: () => (
          <StaffPage as="div">
            <EmailBlockFilters
              search={BLOCKED_ADDRESSES_LIST.read({ kind: "not-on-whatsapp" })}
              numbers
              action={BLOCKED_ADDRESSES_LIST.path}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
