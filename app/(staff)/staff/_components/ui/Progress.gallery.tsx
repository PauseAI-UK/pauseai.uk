// Progress in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Progress from "./Progress";
import StaffPage from "./StaffPage";

export const progressGallery: Example[] = [
  {
    name: "Progress",
    file: "app/(staff)/staff/_components/ui/Progress.tsx",
    variants: [
      {
        label: "Sending, in a list's row, and big, on a page; answers, in green",
        render: () => (
          <StaffPage as="div">
            <div style={{ display: "grid", gap: "24px", maxWidth: "40rem" }}>
              <Progress value={212} max={650} tone="blue" label="Sent">
                Sending: 212 of 650 sent
              </Progress>
              <Progress value={40} max={86} tone="blue" label="Sent" big>
                Sending: 40 of 86 sent
              </Progress>
              <Progress value={14} max={127} tone="green" label="Answered the ask" big>
                Sent: ✓ 14 of 127 answered the ask
              </Progress>
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
