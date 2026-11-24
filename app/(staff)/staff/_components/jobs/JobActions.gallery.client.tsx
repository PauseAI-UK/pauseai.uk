"use client";

// JobActions' examples, which log what's pressed (JobActions.gallery.tsx).
import JobActions from "./JobActions";
import { Logged, loggedDone } from "@/app/(tools)/gallery/_components/wiring";

/** An import's button, its runs logged. */
export function JobActionsExample() {
  return <Logged>{(log) => <JobActions action={loggedDone(log, "action")} label="Check now" />}</Logged>;
}
