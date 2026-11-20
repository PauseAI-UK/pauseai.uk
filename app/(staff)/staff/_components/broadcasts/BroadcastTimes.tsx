"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Hint } from "@/components/ui/Field";
import { Muted } from "@/components/ui/Text";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { finishMinutesOf, finishWithin, sendingStopsAt } from "@/lib/broadcasts/broadcasts";
import { earliestRun, fromLondon, londonDayTime, londonWhen, notTooSoon } from "@/lib/staff-time";
import { DueTimeFields, dueTime } from "../mailings/DueTime";
import writer from "../mailings/MailingWriter.module.css";
import view from "../mailings/MailingView.module.css";
import { mailingsCopy } from "../mailings/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;

/** The finish's own labels, so its fields aren't taken for the start's. */
const FINISH_LABELS = {
  day: copy.keepsTryingUntil,
  hour: mailingsCopy.mailingPages.hour,
  minutes: mailingsCopy.mailingPages.minutes,
};

/**
 * When a broadcast stops trying (sendingStopsAt), as its day, hour and
 * minutes, each kept to what it can be (finishWithin): after its time
 * (`dueAt`), and SENDING_DAYS after it at most; under them, what to set it
 * to. `named` gives them the names a form posts them by, after "finish-".
 */
function FinishFields({
  dueAt,
  finishAt,
  onChange,
  named,
}: {
  dueAt: Date;
  finishAt: Date;
  onChange: (finishAt: Date) => void;
  named?: boolean;
}) {
  const when = dueTime(finishAt);
  return (
    <>
      <div className={writer.when}>
        <DueTimeFields
          day={when.day}
          hour={when.hour}
          minute={when.minute}
          named={named}
          prefix="finish-"
          labels={FINISH_LABELS}
          dayClass={writer.day}
          hourClass={writer.hour}
          // A finish always has its hour, so a change always has its time.
          onChange={(day, time) => onChange(finishWithin(dueAt, fromLondon(day, time!.hour, time!.minute)))}
        />
      </div>
      <Hint>{copy.finishHint}</Hint>
    </>
  );
}

/**
 * When a draft stops trying, in its When section: a line saying when, with
 * Change, which shows its fields (FinishFields). `finishMinutes` is as the
 * draft keeps it; a change gives it again, null for the most.
 */
export function DraftFinish({
  dueAt,
  finishMinutes,
  onChange,
}: {
  dueAt: Date;
  finishMinutes: number | null;
  onChange: (finishMinutes: number | null) => void;
}) {
  const [changing, setChanging] = useState(false);
  const finishAt = sendingStopsAt({ dueAt, finishMinutes });
  if (!changing) {
    return (
      <div className={writer.send}>
        <Muted>{copy.keepsTrying(londonWhen(finishAt, "short"))}</Muted>
        <Button variant="ghost" size="small" fit onClick={() => setChanging(true)}>
          {copy.changeFinish}
        </Button>
      </div>
    );
  }
  return <FinishFields dueAt={dueAt} finishAt={finishAt} onChange={(at) => onChange(finishMinutesOf(dueAt, at))} />;
}

/**
 * Change the times' form, in its bubble: one scheduled's time, never too
 * soon, as the form to change a mailing's has it, and when it stops trying;
 * one sending, when it stops trying alone, as it has gone already. Moving
 * the time moves when it stops trying with it, as the broadcast keeps that.
 */
export function ChangeTimesForm({
  id,
  dueAt,
  finishMinutes,
  scheduled,
  action,
}: {
  id: number;
  dueAt: Date;
  finishMinutes: number | null;
  scheduled: boolean;
  action: (form: FormData) => void | Promise<void>;
}) {
  const [picked, setPicked] = useState(() => dueTime(dueAt));
  const [after, setAfter] = useState(finishMinutes);
  const start = scheduled ? notTooSoon(picked, londonDayTime(earliestRun())) : dueTime(dueAt);
  const due = fromLondon(start.day, start.hour, start.minute);
  return (
    <form action={action} className={view.changeTime}>
      <input type="hidden" name="id" value={id} />
      {scheduled && (
        <div className={writer.when}>
          <DueTimeFields
            day={start.day}
            hour={start.hour}
            minute={start.minute}
            named
            dayClass={writer.day}
            hourClass={writer.hour}
            onChange={(day, time) => setPicked({ day, ...time! })}
          />
        </div>
      )}
      <FinishFields
        dueAt={due}
        finishAt={sendingStopsAt({ dueAt: due, finishMinutes: after })}
        onChange={(at) => setAfter(finishMinutesOf(due, at))}
        named
      />
      <SubmitButton variant="primary" size="small" fit>
        {copy.saveTimes}
      </SubmitButton>
    </form>
  );
}
