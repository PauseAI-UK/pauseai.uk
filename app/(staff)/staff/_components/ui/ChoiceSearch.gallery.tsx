// ChoiceSearch in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ChoiceSearch from "./ChoiceSearch";
import StaffPage from "./StaffPage";

export const choiceSearchGallery: Example[] = [
  {
    name: "ChoiceSearch",
    file: "app/(staff)/staff/_components/ui/ChoiceSearch.tsx",
    variants: [
      {
        label: "Over a long list of choices, which show once something's typed",
        render: () => (
          <StaffPage as="div">
            <ChoiceSearch label="Search these" />
            <ul data-search="empty">
              <li>PauseAI Leicester meetup</li>
              <li>AI risk talk</li>
            </ul>
          </StaffPage>
        ),
      },
    ],
  },
];
