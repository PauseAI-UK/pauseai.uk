// PlaceMap in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import PlaceMap from "./PlaceMap";
import { examplePlace } from "./BroadcastWriter.examples";

export const placeMapGallery: Example[] = [
  {
    name: "PlaceMap",
    file: "app/(staff)/staff/_components/broadcasts/PlaceMap.tsx",
    variants: [
      {
        label: "A drawing of a map, as a fixture build shows it, with its pin, opening Google Maps",
        render: () => (
          <StaffPage as="div">
            <div style={{ width: "14rem" }}>
              <PlaceMap place={examplePlace} />
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
