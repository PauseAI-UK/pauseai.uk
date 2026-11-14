// MenuSelect in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ChannelIcon from "@/components/ui/ChannelIcon";
import MenuSelect from "./MenuSelect";
import StaffPage from "./StaffPage";

export const menuSelectGallery: Example[] = [
  {
    name: "MenuSelect",
    file: "app/(staff)/staff/_components/ui/MenuSelect.tsx",
    variants: [
      {
        label: "A dropdown in a form, its choices in groups with icons, as the filters' menus show them",
        render: () => (
          <StaffPage as="div">
            <MenuSelect
              id="example-menu-select"
              name="choice"
              label="What they opted out of"
              placeholder="Choose…"
              options={[
                {
                  value: "e1",
                  label: "UK newsletter",
                  group: { label: "jane@example.com (email)", icon: <ChannelIcon channel="email" /> },
                },
                {
                  value: "e2",
                  label: "Every bulk email",
                  group: { label: "jane@example.com (email)", icon: <ChannelIcon channel="email" /> },
                },
                {
                  value: "t1",
                  label: "Events only",
                  group: { label: "07700 900123 (text)", icon: <ChannelIcon channel="text" /> },
                },
                {
                  value: "c1",
                  label: "Volunteering",
                  group: { label: "07700 900123 (call)", icon: <ChannelIcon channel="call" /> },
                },
              ]}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
