// ManyChoices in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ChannelIcon from "@/components/ui/ChannelIcon";
import ManyChoices from "./ManyChoices";
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
      {
        label: "Leaving out, with an icon before its name, as a Consent chip has",
        render: () => (
          <StaffPage as="div">
            <ManyChoices
              path="#"
              values={{}}
              name="contact"
              label="Text consent"
              all={["!text:events:yes"]}
              here={["text:events:yes"]}
              not
              oneEach={false}
              options={[{ value: "text:events:yes", label: "Events only" }]}
              every={[]}
              turns
              half={false}
              icon={<ChannelIcon channel="text" />}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
