"use client";

// UnblockForm's examples, whose forms are logged (UnblockForm.gallery.tsx).
import UnblockForm, { UnblockBubble } from "./UnblockForm";
import { exampleBlock, exampleComplaint } from "../oversight/EmailBlocksTable.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** The unblock form for a bounce, logged, and what shows for a complaint instead. */
export function UnblockFormExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <UnblockForm block={exampleBlock} action={log("unblock")} />
          <UnblockForm block={exampleComplaint} action={log("unblock")} />
        </>
      )}
    </Logged>
  );
}

/**
 * A row's button that opens the bubble asking why, its form logged, and what
 * shows for a complaint instead. Its address is its own, as the bubble's ID
 * is made from it, and the table's example is on the same page.
 */
export function UnblockBubbleExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <UnblockBubble block={{ address: "bounced@parliament.example", canReset: true }} action={log("unblock")} />
          <UnblockBubble block={exampleComplaint} action={log("unblock")} />
        </>
      )}
    </Logged>
  );
}
