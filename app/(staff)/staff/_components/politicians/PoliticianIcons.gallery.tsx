// PoliticianIcons in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { NationShape, Rosette, StatusDot } from "./PoliticianIcons";

export const politicianIconsGallery: Example[] = [
  {
    name: "Rosette",
    file: "app/(staff)/staff/_components/politicians/PoliticianIcons.tsx",
    variants: [
      {
        label: "Each party's colour, and grey for one we don't know",
        render: () => (
          <StaffPage as="div">
            <p style={{ display: "flex", gap: "12px" }}>
              {[
                "Labour",
                "Conservative",
                "Liberal Democrats",
                "Scottish National Party",
                "Green",
                "Plaid Cymru",
                "Reform UK",
                "DUP",
                "Sinn Féin",
                "Alliance",
                "Crossbench",
              ].map((party) => (
                <Rosette key={party} party={party} />
              ))}
            </p>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "StatusDot",
    file: "app/(staff)/staff/_components/politicians/PoliticianIcons.tsx",
    variants: [
      {
        label: "In office, and not",
        render: () => (
          <StaffPage as="div">
            <p style={{ display: "flex", gap: "12px" }}>
              <StatusDot inOffice />
              <StatusDot inOffice={false} />
            </p>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "NationShape",
    file: "app/(staff)/staff/_components/politicians/PoliticianIcons.tsx",
    variants: [
      {
        label: "The four nations",
        render: () => (
          <StaffPage as="div">
            <p style={{ display: "flex", gap: "12px" }}>
              {(["england", "scotland", "wales", "northern-ireland"] as const).map((country) => (
                <NationShape key={country} country={country} />
              ))}
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
