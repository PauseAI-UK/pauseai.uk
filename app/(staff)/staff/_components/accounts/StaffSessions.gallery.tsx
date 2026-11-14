// StaffSessions in the component gallery (app/(tools)/gallery/), in the staff admin
// group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import StaffSessions from "./StaffSessions";

export const staffSessionsGallery: Example[] = [
  {
    name: "StaffSessions",
    file: "app/(staff)/staff/_components/accounts/StaffSessions.tsx",
    variants: [
      {
        label: "Three sessions: this browser's, a kept one on a phone, and one from a browser we can't name",
        render: () => (
          <StaffPage as="div">
            <StaffSessions
              sessions={[
                {
                  id: "session-1",
                  userAgent:
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",

                  startedAt: new Date("2026-10-22T09:00:00Z"),
                  expiresAt: new Date("2026-10-23T09:00:00Z"),
                  remember: false,
                  current: true,
                },
                {
                  id: "session-2",
                  userAgent:
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",

                  startedAt: new Date("2026-10-20T08:00:00Z"),
                  expiresAt: new Date("2026-11-21T08:00:00Z"),
                  remember: true,
                  current: false,
                },
                {
                  id: "session-3",
                  userAgent: null,

                  startedAt: new Date("2026-10-19T18:30:00Z"),
                  expiresAt: new Date("2026-10-20T18:30:00Z"),
                  remember: false,
                  current: false,
                },
              ]}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
