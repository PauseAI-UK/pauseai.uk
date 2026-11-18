// BroadcastsOverview in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { exampleBroadcastSummary } from "./BroadcastWriter.examples";
import BroadcastsOverview from "./BroadcastsOverview";
import StaffPage from "../ui/StaffPage";
import { mailingGroups } from "@/lib/mailings/groups";
import type { SendingPause } from "@/lib/broadcasts/broadcasts";

const now = "2026-11-05T12:00:00Z";
const groups = mailingGroups(
  {
    drafts: [
      { ...exampleBroadcastSummary, id: 3, state: "draft" as const, title: "Events near you", to: 412 },
      {
        ...exampleBroadcastSummary,
        id: 5,
        state: "draft" as const,
        channel: "text" as const,
        title: "Rain on Saturday",
        to: 96,
        waiting: true,
        sentFrom: "+447700900000",
        fromName: "PauseAI UK",
      },
      {
        ...exampleBroadcastSummary,
        id: 8,
        state: "draft" as const,
        channel: "text" as const,
        title: "PauseCon doors",
        to: 96,
        approved: true,
        sentFrom: "+447700900000",
        fromName: "PauseAI UK",
      },
    ],
    comingUp: [
      {
        ...exampleBroadcastSummary,
        id: 4,
        state: "scheduled" as const,
        channel: "text" as const,
        dueAt: new Date("2026-11-07T07:18:00Z"),
        title: "March day: where to meet",
        fromName: "PauseAI UK",
        sentFrom: "+447700900000",
      },
      {
        ...exampleBroadcastSummary,
        id: 6,
        state: "scheduled" as const,
        dueAt: new Date("2026-11-08T07:18:00Z"),
        title: "Sunday's stall",
      },
    ],
    sent: [
      exampleBroadcastSummary,
      {
        ...exampleBroadcastSummary,
        id: 7,
        channel: "text" as const,
        read: 240,
        title: "PauseCon: the room has changed",
      },
    ],
  },
  new Date(now),
);

/** One sending, 480 of its 500 gone, with this pause, or none. */
const sending = (id: number, title: string, pause: SendingPause | null) => ({
  ...exampleBroadcastSummary,
  id,
  title,
  state: "sending" as const,
  channel: "text" as const,
  fromName: "PauseAI UK",
  sentFrom: "+447700900000",
  dueAt: new Date("2026-11-05T09:18:00Z"),
  to: 500,
  sent: 480,
  failed: 0,
  states: {
    ...exampleBroadcastSummary.states,
    "opted-out": 0,
    error: 0,
    unreached: 0,
    "not-sent": 0,
    sent: 480,
    held: 20,
  },
  pause,
});
const until = new Date("2026-11-06T10:07:00Z");
const paused = mailingGroups(
  {
    drafts: [],
    comingUp: [
      sending(11, "Going out", null),
      sending(12, "Waiting for CiviCRM", { kind: "waiting", reason: "pull", said: null, endsAt: until }),
      sending(13, "Resting after its sends failed", { kind: "resting", until: new Date("2026-11-05T12:20:00Z") }),
      sending(14, "Its last texts held by WhatsApp", { kind: "held", held: 20, until, stopsAt: until }),
      sending(15, "At today's limit", { kind: "limit", channel: "text" }),
    ],
    sent: [],
  },
  new Date(now),
);

export const broadcastsOverviewGallery: Example[] = [
  {
    name: "BroadcastsOverview",
    file: "app/(staff)/staff/_components/broadcasts/BroadcastsOverview.tsx",
    variants: [
      {
        label: "Emails and texts together",
        render: () => (
          <StaffPage as="div">
            <BroadcastsOverview groups={groups} now={now} />
          </StaffPage>
        ),
      },
      {
        label: "Sending: one going out, in blue, then each pause, in amber over a grey bar",
        render: () => (
          <StaffPage as="div">
            <BroadcastsOverview groups={paused} now={now} />
          </StaffPage>
        ),
      },
      {
        label: "None yet",
        render: () => (
          <StaffPage as="div">
            <BroadcastsOverview groups={[]} now={now} />
          </StaffPage>
        ),
      },
    ],
  },
];
