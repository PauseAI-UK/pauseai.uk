// SupporterFilters in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { supportersSearch } from "@/lib/staff-search";
import StaffPage from "../ui/StaffPage";
import SupporterFilters from "./SupporterFilters";

/** Luma events a filter of supporters picks from, newest first. */
const exampleEventChoices = [
  { id: "evt-1", name: "PauseAI Leicester meetup", startAt: new Date("2026-10-20T18:00:00Z") },
  { id: "evt-2", name: "AI risk talk", startAt: new Date("2026-10-12T18:00:00Z") },
  { id: "evt-3", name: "PauseAI London March", startAt: new Date("2026-09-05T11:00:00Z") },
];

export const supporterFiltersGallery: Example[] = [
  {
    name: "SupporterFilters",
    file: "app/(staff)/staff/_components/supporters/SupporterFilters.tsx",
    variants: [
      {
        label: "The list's filters, with a search typed, two activities, a campaign not written in, and near Leeds",
        render: () => (
          <StaffPage as="div">
            <SupporterFilters
              search={supportersSearch({
                q: "jane",
                activity: ["registered", "member"],
                contact: "email:events:unsubscribed",
                campaign: "support-sobel-bill",
                wrote: "no",
                mp: "!7",
                near: "LS1",
                within: "25",
                sort: "name",
              })}
              choices={{
                events: exampleEventChoices,
                mps: [{ id: 7, name: "Alex Sobel", constituency: "Leeds Central and Headingley" }],
              }}
              near={{ latitude: 53.8, longitude: -1.55, place: "Leeds", country: "england" }}
            />
          </StaffPage>
        ),
      },
      {
        label: "Choosing who a broadcast goes to: its Consent locked",
        render: () => (
          <StaffPage as="div">
            <SupporterFilters
              search={supportersSearch({ contact: "email:newsletter:yes", near: "LS1", broadcast: "3" })}
              choices={{ events: exampleEventChoices, mps: [] }}
              lockConsent
            />
          </StaffPage>
        ),
      },
      {
        label: "Near somewhere postcodes.io doesn't know",
        render: () => (
          <StaffPage as="div">
            <SupporterFilters
              search={supportersSearch({ near: "Atlantis" })}
              choices={{ events: [], mps: [] }}
              near={null}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
