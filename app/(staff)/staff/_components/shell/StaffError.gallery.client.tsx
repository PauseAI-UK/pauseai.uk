"use client";

// StaffError's example, whose button is logged (StaffError.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import StaffError from "./StaffError";

/** An error as the server's arrives, with a digest, so the example tells the site of nothing. */
const THROWN = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1" });

/** A staff page that threw, its button logged. */
export function StaffErrorExample() {
  return <Logged>{(log) => <StaffError error={THROWN} retry={log("retry")} />}</Logged>;
}
