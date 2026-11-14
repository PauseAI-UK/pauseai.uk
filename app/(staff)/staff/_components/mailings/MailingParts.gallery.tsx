// MailingParts in the component gallery (app/(tools)/gallery/), in the staff mailings and events
// group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { FilterPills } from "./MailingParts";
import { examplePickedGroup, examplePickedList, exampleWriterData } from "./MailingWriter.examples";
import StaffPage from "../ui/StaffPage";

export const mailingPartsGallery: Example[] = [
  {
    name: "FilterPills",
    file: "app/(staff)/staff/_components/mailings/MailingParts.tsx",
    variants: [
      {
        label: "The Commons who aren't Labour, who answered an ask",
        render: () => (
          <StaffPage as="div">
            <FilterPills data={exampleWriterData} />
          </StaffPage>
        ),
      },
      {
        label: "Everyone in office",
        render: () => (
          <StaffPage as="div">
            <FilterPills data={{ ...exampleWriterData, filter: { list: "politicians", params: {} } }} />
          </StaffPage>
        ),
      },
      {
        label: "Ticked from a filter's group on a day, with one added and one taken off since",
        render: () => (
          <StaffPage as="div">
            <FilterPills data={examplePickedGroup} />
          </StaffPage>
        ),
      },
      {
        label: "Ticked one by one: their names",
        render: () => (
          <StaffPage as="div">
            <FilterPills data={examplePickedList} />
          </StaffPage>
        ),
      },
      {
        label: "No one ticked yet",
        render: () => (
          <StaffPage as="div">
            <FilterPills
              data={{ ...examplePickedList, filter: { list: "politicians", params: {}, picked: { ids: [] } } }}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
