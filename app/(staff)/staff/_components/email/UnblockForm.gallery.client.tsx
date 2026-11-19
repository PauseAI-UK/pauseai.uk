"use client";

// UnblockForm's examples, whose forms are logged (UnblockForm.gallery.tsx).
import UnblockForm, { UnblockBubble } from "./UnblockForm";
import { exampleBlock, exampleComplaint } from "../oversight/BlocksTable.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** A bounce Postmark won't send to again, which staff can't unblock. */
const stuck = { ...exampleBlock, canReset: false };

/** The unblock form for a bounce, logged, and what shows instead for a complaint and for a bounce Postmark won't resend. */
export function UnblockFormExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <UnblockForm block={exampleBlock} action={log("unblock")} />
          <UnblockForm block={exampleComplaint} action={log("unblock")} />
          <UnblockForm block={stuck} action={log("unblock")} />
        </>
      )}
    </Logged>
  );
}

/**
 * A row's button that opens the bubble asking why, its form logged, and what
 * shows instead for a complaint and for a bounce Postmark won't resend. Its
 * address is its own, as the bubble's ID is made from it, and the table's
 * example is on the same page.
 */
export function UnblockBubbleExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <UnblockBubble
            block={{ address: "bounced@parliament.example", canReset: true, kind: "hard" }}
            action={log("unblock")}
          />
          <UnblockBubble block={exampleComplaint} action={log("unblock")} />
          <UnblockBubble block={stuck} action={log("unblock")} />
        </>
      )}
    </Logged>
  );
}
