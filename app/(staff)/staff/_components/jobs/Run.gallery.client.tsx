"use client";

// Run's examples, which log what's pressed (Run.gallery.tsx).
import Run from "./Run";
import { exampleHeldImport } from "./RunList.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** An MP sync held for a decision: apply and discard log what they'd send. */
export function HeldImportExample() {
  return <Logged>{(log) => <Run run={exampleHeldImport} decide={log("decide")} />}</Logged>;
}
