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
              written={{ ...exampleBroadcastEmail, state: "sending" }}
              pause={{
                kind: "waiting",
                reason: "civicrm",
                said: "CiviCRM request failed with status 500: pauseai_core: phone 11 is not a number in international format (+, the country code, then the number).",
                endsAt: new Date("2026-11-10T07:18:00Z"),
              }}
            />
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason: "pull" }}
              pause={null}
            />
          </StaffPage>
        ),
      },
      {
        label: "By Gmail: at today's limit, the rest tomorrow; and stopped, as it hadn't all gone in three days",
        render: () => (
          <StaffPage as="div">
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, state: "sending" }}
              pause={{ kind: "limit", channel: "email" }}
            />
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason: "limit" }}
              pause={null}
              resume={<ResumeBroadcastExample id={8} />}
            />
          </StaffPage>
        ),
      },
      {
        label: "A text: its last texts held by WhatsApp; and at our number's limit for today",
        render: () => (
          <StaffPage as="div">
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, channel: "text", state: "sending" }}
              pause={{
                kind: "held",
                held: 20,
                until: new Date("2026-11-19T10:07:00Z"),
                stopsAt: new Date("2026-11-24T09:00:00Z"),
              }}
            />
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, channel: "text", state: "sending" }}
              pause={{ kind: "limit", channel: "text" }}
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
              pause={null}
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
              written={{ ...exampleBroadcastEmail, state: "sending" }}
              pause={{ kind: "resting", until: new Date("2026-11-07T07:43:00Z") }}
            />
            <BroadcastWaiting
              written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason: "failing" }}
              pause={null}
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
              pause={null}
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
