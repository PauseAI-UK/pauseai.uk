"use client";

// DueTime's examples, which keep or log the time chosen (DueTime.gallery.tsx).
import { useState } from "react";
import { ChangeTimeForm, DueTimeFields } from "./DueTime";
import { SENDING } from "@/lib/staff-time";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** A mailing's day, hour and minutes, today with no hour chosen: the hours too soon can't be, nor the minutes till one is. */
export function DueTimeFieldsExample() {
  const [when, setWhen] = useState<{ day: string; hour: number | null; minute: number }>({
    day: "2026-10-16",
    hour: null,
    minute: SENDING.minutes[0],
  });
  return (
    <DueTimeFields
      day={when.day}
      hour={when.hour}
      minute={when.minute}
      onChange={(day, time) => setWhen((was) => ({ ...was, day, ...time }))}
    />
  );
}

/**
 * Change the time's form, for a mailing due in the new year: far enough
 * ahead that the page, rendered when the site is built, shows the same
 * day and hours as the browser does.
 */
export function ChangeTimeFormExample() {
  return (
    <Logged>
      {(log) => <ChangeTimeForm id={5} dueAt={new Date("2027-01-15T09:00:00Z")} action={log("rescheduleMailingNow")} />}
    </Logged>
  );
}
