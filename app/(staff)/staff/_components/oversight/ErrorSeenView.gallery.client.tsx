"use client";

// ErrorSeenView's examples, whose button is logged (ErrorSeenView.gallery.tsx).
import ErrorSeenView from "./ErrorSeenView";
import { exampleErrorDone, exampleErrorsSeen } from "./ErrorsSeen.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** An error's page, its button logged: the examples' errors by their place in the list, or the one marked done. */
export function ErrorSeenViewExample({ which }: { which: 0 | 1 | 2 | "done" }) {
  const error = which === "done" ? exampleErrorDone : exampleErrorsSeen[which];
  return <Logged>{(log) => <ErrorSeenView error={error} setDone={log("setDone")} />}</Logged>;
}
