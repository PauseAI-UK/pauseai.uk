// Strip in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { Button } from "@/components/ui/Button";
import StaffPage from "./StaffPage";
import Strip from "./Strip";

export const stripGallery: Example[] = [
  {
    name: "Strip",
    file: "app/(staff)/staff/_components/ui/Strip.tsx",
    variants: [
      {
        label: "Each tone: plain, green, amber, red, blue and dark, with an action at the right",
        render: () => (
          <StaffPage as="div">
            <div style={{ display: "grid", gap: "8px" }}>
              <Strip>
                <span>Not signed</span>
              </Strip>
              <Strip tone="green">
                <span>Signed, 1 Oct 2026</span>
                <span>Set by jo@pauseai.uk</span>
              </Strip>
              <Strip
                tone="amber"
                action={
                  <Button variant="primary" size="small">
                    Review import
                  </Button>
                }
              >
                <span>MP import would change 42 MPs</span>
                <span>Check it, and approve or decline it.</span>
              </Strip>
              <Strip tone="blue">
                <span>Running, started by jo@pauseai.uk</span>
              </Strip>
              <Strip
                tone="red"
                action={
                  <Button variant="primary" size="small">
                    Fix MP email
                  </Button>
                }
              >
                <span>Bouncy McTestface MP&apos;s email is bouncing</span>
                <span>Find a working email, or unblock it.</span>
              </Strip>
              <Strip tone="dark" action={<a href="#">Cancel</a>}>
                <span>New mailing: tick who it&apos;s for</span>
                <span>Tick each person it&apos;s for.</span>
              </Strip>
            </div>
          </StaffPage>
        ),
      },
      {
        label: "An answer, not a warning: no icon",
        render: () => (
          <StaffPage as="div">
            <Strip tone="red" icon={false}>
              <span>Won&apos;t email</span>
            </Strip>
          </StaffPage>
        ),
      },
    ],
  },
];
