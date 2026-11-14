"use client";

// DraftWriter's examples, which log what is chosen (DraftWriter.gallery.tsx).
import { DraftTitle, DueSection, ProblemList, ScheduleButton } from "./DraftWriter";
import Numbered from "../ui/Numbered";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** A Server Action that does nothing. */
const nothing = async () => {};

/** A draft's title, with whether it's saved, and a numbered section's title. */
export function DraftTitleExample() {
  return (
    <>
      <DraftTitle title="Events near you this month" saveState="saved" />
      <h2>
        <Numbered n={1}>To</Numbered>
      </h2>
    </>
  );
}

/** Scheduling, refused, as the server says when something stops it. */
const refused = async () => ({ scheduled: false });

/** A draft's foot: Schedule, enabled and refused, what stops it, and when it goes, its choice logged. */
export function DraftFootExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <DueSection dueAt={null} onChange={log("dueAt")} />
          <ScheduleButton label="Schedule 412 emails" disabled={false} saveNow={nothing} schedule={refused} />
          <ScheduleButton label="Schedule 412 emails" disabled saveNow={nothing} schedule={refused} />
          <ProblemList problems={["Fill in the subject.", "Choose what time it will be sent."]} />
          <ProblemList problems={[]} />
        </>
      )}
    </Logged>
  );
}
