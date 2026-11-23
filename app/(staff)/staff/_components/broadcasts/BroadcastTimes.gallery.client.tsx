"use client";

// BroadcastTimes' examples, which keep or log the times chosen (BroadcastTimes.gallery.tsx).
import { useState } from "react";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import { ChangeTimesForm, DraftFinish } from "./BroadcastTimes";

/** A broadcast due in the new year: far enough ahead that the page, rendered when the site is built, shows the same days and hours as the browser does. */
const DUE = new Date("2027-01-15T09:18:00Z");

/** When a draft keeps trying until, seven days after its time till it's changed, which keeps the change. */
export function DraftFinishExample() {
  const [finishMinutes, setFinishMinutes] = useState<number | null>(null);
  return <DraftFinish dueAt={DUE} finishMinutes={finishMinutes} onChange={setFinishMinutes} />;
}

/** Change the times' form, for one scheduled, keeping trying a day; or for one sending, when it keeps trying until alone. */
export function ChangeTimesFormExample({ scheduled }: { scheduled: boolean }) {
  return (
    <Logged>
      {(log) => (
        <ChangeTimesForm
          id={5}
          dueAt={DUE}
          finishMinutes={24 * 60}
          scheduled={scheduled}
          action={log("rescheduleBroadcastNow")}
        />
      )}
    </Logged>
  );
}
