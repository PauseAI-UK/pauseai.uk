"use client";

import { useEffect, useReducer, useState } from "react";
import { Select } from "@/components/ui/Controls";
import DatePicker from "@/components/ui/DatePicker";
import { Field } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { staffCopy } from "@/lib/content/staff-interface";
import styles from "./DueTime.module.css";
import {
  earliestRun,
  fromLondon,
  londonDayTime,
  notTooSoon,
  sendsAt,
  SENDING,
  type LondonTime,
} from "@/lib/staff-time";

const copy = staffCopy.mailingPages;

/** How often a time picker checks the time it shows hasn't become too soon. */
export const CHECK_EVERY = 30_000;

const twoDigits = (n: number) => String(n).padStart(2, "0");

/**
 * The hours a mailing can be due in on `day`, in London: those the sending
 * runs in, so overnight ones aren't offered. Which those are moves with the
 * clocks.
 */
function sendingHours(day: string): number[] {
  return Array.from({ length: 24 }, (_, h) => h).filter(
    (h) => londonDayTime(sendsAt(fromLondon(day, h, SENDING.minutes[0]))).hour === h,
  );
}

/**
 * When a mailing goes, as its time: the run of the sending a time picks, in
 * London, so one due at a time the sending doesn't run at, on the hour or
 * overnight, shows as the run it goes on.
 */
export function dueTime(dueAt: Date): LondonTime {
  return londonDayTime(sendsAt(dueAt));
}

/**
 * A mailing's day, hour and minutes, in London: the runs of the sending,
 * never too soon. No day before the first it can go, and on that day the
 * hours and minutes too soon can't be chosen; a change that would make it
 * too soon moves it on to the first it can go at. With no hour yet, the
 * hour says Choose. `named` gives the controls the names a form posts them
 * by: day, hour and minute.
 */
export function DueTimeFields({
  day,
  hour,
  minute,
  onChange,
  named,
  dayClass,
  hourClass,
}: {
  day: string;
  hour: number | null;
  minute: number;
  onChange: (day: string, time: { hour: number; minute: number } | null) => void;
  named?: boolean;
  dayClass?: string;
  hourClass?: string;
}) {
  const earliest = londonDayTime(earliestRun());
  const change = (to: { day: string; hour: number; minute: number }) => {
    const time = notTooSoon(to, earliest);
    onChange(time.day, { hour: time.hour, minute: time.minute });
  };
  const firstDay = day === earliest.day;
  return (
    <>
      <Field label={copy.day} className={dayClass}>
        <DatePicker
          name={named ? "day" : undefined}
          min={earliest.day}
          value={day}
          onChange={(picked) => (hour === null ? onChange(picked, null) : change({ day: picked, hour, minute }))}
        />
      </Field>
      {/* The hour and its minutes side by side, as a time reads. */}
      <div className={styles.time}>
        <Field label={copy.hour} className={hourClass}>
          <Select
            name={named ? "hour" : undefined}
            value={hour ?? ""}
            onChange={(event) => change({ day, hour: Number(event.target.value), minute })}
          >
            {hour === null && (
              <option value="" disabled>
                {copy.choose}
              </option>
            )}
            {sendingHours(day).map((h) => (
              // On the first day it can go, the hours too soon can't be chosen.
              <option key={h} value={h} disabled={firstDay && h < earliest.hour}>
                {twoDigits(h)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={copy.minutes} className={hourClass}>
          <Select
            name={named ? "minute" : undefined}
            value={minute}
            // Chosen with its hour, not before.
            disabled={hour === null}
            onChange={(event) => change({ day, hour: hour!, minute: Number(event.target.value) })}
          >
            {SENDING.minutes.map((m) => (
              // In the first hour it can go, the minutes too soon can't be chosen.
              <option key={m} value={m} disabled={firstDay && hour === earliest.hour && m < earliest.minute}>
                :{twoDigits(m)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </>
  );
}

/**
 * Change the time's form: a scheduled mailing's day, hour and minutes,
 * starting at when it goes, or the first time it can go at once that's too
 * soon, as it becomes while the form is open.
 */
export function ChangeTimeForm({
  id,
  dueAt,
  action,
  className,
}: {
  id: number;
  dueAt: Date;
  action: (form: FormData) => void | Promise<void>;
  className?: string;
}) {
  const [picked, setPicked] = useState(() => dueTime(dueAt));
  // Each check draws it again, so a time that's become too soon moves on.
  const [, check] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const timer = setInterval(check, CHECK_EVERY);
    return () => clearInterval(timer);
  }, []);
  const when = notTooSoon(picked, londonDayTime(earliestRun()));
  return (
    <form action={action} className={className}>
      <input type="hidden" name="id" value={id} />
      <DueTimeFields
        day={when.day}
        hour={when.hour}
        minute={when.minute}
        named
        onChange={(day, time) => setPicked({ day, ...time! })}
      />
      <SubmitButton variant="primary" size="small" fit>
        {copy.saveTime}
      </SubmitButton>
    </form>
  );
}
