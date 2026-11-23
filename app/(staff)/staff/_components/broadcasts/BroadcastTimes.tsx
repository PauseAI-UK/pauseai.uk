"use client";

import { useId, useState } from "react";
import Bubble from "@/components/ui/Bubble";
import { helpButtonClass } from "../ui/HelpButton";
import { Select } from "@/components/ui/Controls";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { FINISH_CHOICES, finishKept, MOST_FINISH_MINUTES, sendingStopsAt } from "@/lib/broadcasts/broadcasts";
import { earliestRun, fromLondon, londonDayTime, londonWhen, notTooSoon } from "@/lib/staff-time";
import { DueTimeFields, dueTime } from "../mailings/DueTime";
import writer from "../mailings/MailingWriter.module.css";
import view from "../mailings/MailingView.module.css";
import own from "./Broadcasts.module.css";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;

/**
 * How long a broadcast keeps trying to reach those it hasn't, as a sentence
 * with its choice in it, of FINISH_CHOICES, and until when that is after its
 * time (`dueAt`), then a "?" that says at length why it keeps trying and
 * what to choose. `finishMinutes` is as it keeps
 * it, none for the most, as a change gives it again; `named` gives the choice
 * the name a form posts it by, finish-minutes, the most as its minutes.
 */
function FinishChoice({
  dueAt,
  finishMinutes,
  onChange,
  named,
}: {
  dueAt: Date;
  finishMinutes: number | null;
  onChange: (finishMinutes: number | null) => void;
  named?: boolean;
}) {
  const why = `keeps-trying-${useId()}`;
  return (
    <div className={own.keepsTrying}>
      <span>{copy.keepsTryingFor}</span>
      <span className={own.length}>
        <Select
          name={named ? "finish-minutes" : undefined}
          aria-label={copy.keepsTryingFor}
          value={finishMinutes ?? MOST_FINISH_MINUTES}
          onChange={(event) => onChange(finishKept(Number(event.target.value)))}
        >
          {FINISH_CHOICES.map((minutes) => (
            <option key={minutes} value={minutes}>
              {copy.finishChoice(minutes)}
            </option>
          ))}
        </Select>
      </span>
      <span>{copy.untilWhen(londonWhen(sendingStopsAt({ dueAt, finishMinutes }), "short"))}</span>
      {/* Why it keeps trying, and what to choose, at length, a press away. */}
      <Bubble id={why} label="?" trigger={helpButtonClass()} name={copy.whyKeepsTrying} className={own.whyBubble}>
        {copy.keepsTryingWhy.map((paragraph) => (
          <p key={paragraph} className={own.whyWords}>
            {paragraph}
          </p>
        ))}
      </Bubble>
    </div>
  );
}

/** How long a draft keeps trying, in its When section, which it keeps as its time moves (FinishChoice). */
export function DraftFinish(props: {
  dueAt: Date;
  finishMinutes: number | null;
  onChange: (finishMinutes: number | null) => void;
}) {
  return <FinishChoice {...props} />;
}

/**
 * Change the times' form, in its bubble: one scheduled's time, never too
 * soon, as the form to change a mailing's has it, and how long it keeps
 * trying; one sending, how long it keeps trying alone, as it has gone
 * already. Under them, when that makes it stop trying.
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
      <FinishChoice dueAt={due} finishMinutes={after} onChange={setAfter} named />
      <SubmitButton variant="primary" size="small" fit>
        {copy.saveTimes}
      </SubmitButton>
    </form>
  );
}
