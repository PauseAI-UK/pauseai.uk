// BroadcastsOverview in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { exampleBroadcastSummary } from "./BroadcastWriter.examples";
import BroadcastsOverview from "./BroadcastsOverview";
import StaffPage from "../ui/StaffPage";
import { mailingGroups } from "@/lib/mailings/groups";

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
