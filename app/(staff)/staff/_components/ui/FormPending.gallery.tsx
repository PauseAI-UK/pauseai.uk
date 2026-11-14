// FormPending in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import FormPending from "./FormPending";
import StaffPage from "./StaffPage";

export const formPendingGallery: Example[] = [
  {
    name: "FormPending",
    file: "app/(staff)/staff/_components/ui/FormPending.tsx",
    variants: [
      {
        label: "Unseen, in a list's search form: marks it pending while its search loads, for the line along the top",
        render: () => (
          <StaffPage as="div">
            <form>
              <FormPending />
            </form>
          </StaffPage>
        ),
      },
    ],
  },
];
