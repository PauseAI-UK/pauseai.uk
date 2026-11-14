// SupporterBroadcasts in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import SupporterBroadcasts from "./SupporterBroadcasts";
import StaffPage from "../ui/StaffPage";

export const supporterBroadcastsGallery: Example[] = [
  {
    name: "SupporterBroadcasts",
    file: "app/(staff)/staff/_components/broadcasts/SupporterBroadcasts.tsx",
    variants: [
      {
        label: "Those they were sent, one with a reply to look at",
        render: () => (
          <StaffPage as="div">
            <SupporterBroadcasts
              broadcasts={[
                {
                  copyId: 21,
                  messageId: 5,
                  title: "March day: where to meet",
                  channel: "text",
                  status: "delivered",
                  skipReason: null,
                  sentAt: new Date("2026-11-07T07:18:00Z"),
                  state: "read",
                  why: null,
                },
                {
                  copyId: 23,
                  messageId: 7,
                  title: "Thank you for marching",
                  channel: "email",
                  status: "delivered",
                  skipReason: null,
                  sentAt: new Date("2026-11-06T09:18:00Z"),
                  state: "look",
                  why: null,
                },
                {
                  copyId: 22,
                  messageId: 6,
                  title: "",
                  channel: "email",
                  status: "failed",
                  skipReason: null,
                  sentAt: null,
                  state: "error",
                  why: "gmail",
                },
              ]}
            />
            <SupporterBroadcasts broadcasts={[]} />
          </StaffPage>
        ),
      },
    ],
  },
];
