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
      {
        label: "Choices with a tag, their words and a line of facts, in a wider menu, one at its foot",
        render: () => (
          <StaffPage as="div">
            <MenuSelect
              id="example-menu-select-facts"
              label="Template"
              placeholder="Choose a template"
              value="t2"
              options={[
                {
                  value: "t1",
                  label: "The march meets at 11:00",
                  words: "Hi {First name}, the march meets at 11:00 at Parliament Square.",
                  facts: [
                    "jo@pauseai.uk",
                    "Approved 20 Oct 2026",
                    "Last sent 2 Nov 2026, to 318 people",
                    "Used in: 2 sent",
                  ],
                },
                {
                  value: "t2",
                  label: "Thank you for coming.",
                  tag: "Unused",
                  words: "Hi {First name}, thank you for coming. Here is what happens next.",
                  facts: ["sam@pauseai.uk", "Approved 25 Sept 2026"],
                },
              ]}
              last={{ value: "new", label: "New template" }}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
