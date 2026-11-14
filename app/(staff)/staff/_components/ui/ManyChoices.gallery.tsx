// ManyChoices in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ManyChoices, { NotWords } from "./ManyChoices";
import StaffPage from "./StaffPage";

const EXAMPLE_NATIONS = [
  {
    name: "nation",
    label: "Nation",
    repeat: true,
    options: [
      { value: "england", label: "England" },
      { value: "scotland", label: "Scotland" },
      { value: "wales", label: "Wales" },
      { value: "ireland", label: "Northern Ireland" },
    ],
  },
];

export const manyChoicesGallery: Example[] = [
  {
    name: "ManyChoices",
    file: "app/(staff)/staff/_components/ui/ManyChoices.tsx",
    variants: [
      {
        label: "In a chip's menu: several chosen, so it opens as boxes",
        render: () => (
          <StaffPage as="div">
            <ManyChoices
              path="#"
              values={{}}
              name="nation"
              label="Nation"
              all={["scotland", "england"]}
              here={["scotland", "england"]}
              not={false}
              oneEach
              options={EXAMPLE_NATIONS[0].options}
              every={EXAMPLE_NATIONS[0].options.map((option) => option.value)}
              turns
              half={false}
            />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "NotWords",
    file: "app/(staff)/staff/_components/ui/ManyChoices.tsx",
    variants: [
      {
        label: "A chip's words that leave out, before its choices",
        render: () => (
          <StaffPage as="div">
            <NotWords label="Nation" />
          </StaffPage>
        ),
      },
    ],
  },
];
