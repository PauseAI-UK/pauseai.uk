// BroadcastView in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { ResumeBroadcastExample } from "../mailings/MailingButtons.gallery.client";
import { BroadcastChannelMark, BroadcastWaiting } from "./BroadcastView";
import { exampleBroadcastEmail } from "./BroadcastWriter.examples";
import StaffPage from "../ui/StaffPage";
import { BroadcastViewExample } from "./BroadcastView.gallery.client";

export const broadcastViewGallery: Example[] = [
  {
    name: "BroadcastChannelMark",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastView.tsx",
    variants: [
      {
        label: "Each channel",
        render: () => (
          <div style={{ display: "flex", gap: "1rem" }}>
            <BroadcastChannelMark channel="email" />
            <BroadcastChannelMark channel="text" />
          </div>
        ),
      },
    ],
  },
  {
    name: "BroadcastWaiting",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastView.tsx",
    variants: [
      {
        label: "Waiting for CiviCRM, since when and why; and stopped, as it waited too long",
        render: () => (
          <StaffPage as="div">
            <BroadcastWaiting
              written={{
                ...exampleBroadcastEmail,
                state: "sending",
                waitingSince: new Date("2026-11-07T07:18:00Z"),
                waitReason: "civicrm",
              }}
            />
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason: "pull" }}
            />
          </StaffPage>
        ),
      },
      {
        label: "By Gmail: at today's limit, the rest tomorrow; and stopped, as it hadn't all gone in three days",
        render: () => (
          <StaffPage as="div">
            <BroadcastWaiting written={{ ...exampleBroadcastEmail, state: "sending" }} atLimit />
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason: "limit" }}
              resume={<ResumeBroadcastExample id={8} />}
            />
          </StaffPage>
        ),
      },
      {
        label: "A text stopped, as WhatsApp paused its template",
        render: () => (
          <StaffPage as="div">
            <BroadcastWaiting
              written={{
                ...exampleBroadcastEmail,
                channel: "text",
                state: "cancelled",
                gaveUp: true,
                waitReason: "template",
              }}
              resume={<ResumeBroadcastExample id={9} />}
            />
          </StaffPage>
        ),
      },
      {
        label: "Resting after its sends failed; and stopped, as they kept failing",
        render: () => (
          <StaffPage as="div">
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, state: "sending", restingUntil: new Date("2026-11-07T07:43:00Z") }}
            />
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason: "failing" }}
              resume={<ResumeBroadcastExample id={10} />}
            />
          </StaffPage>
        ),
      },
      {
        label: "Stopped, as its seven days ran out while CiviCRM was down",
        render: () => (
          <StaffPage as="div">
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason: "late" }}
              resume={<ResumeBroadcastExample id={11} />}
            />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "BroadcastView",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastView.tsx",
    variants: [
      {
        label: "An email sent",
        render: () => (
          <StaffPage as="div">
            <BroadcastViewExample kind="email" />
          </StaffPage>
        ),
      },
      {
        label: "A text sent",
        render: () => (
          <StaffPage as="div">
            <BroadcastViewExample kind="text" />
          </StaffPage>
        ),
      },
      {
        label: "A text scheduled",
        render: () => (
          <StaffPage as="div">
            <BroadcastViewExample kind="scheduled" />
          </StaffPage>
        ),
      },
    ],
  },
];
