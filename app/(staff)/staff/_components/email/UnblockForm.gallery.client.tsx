"use client";

// UnblockForm's examples, whose forms are logged (UnblockForm.gallery.tsx).
import UnblockForm, { UnblockBubble, type Unblock } from "./UnblockForm";
import { exampleBlock, exampleComplaint } from "../oversight/BlocksTable.examples";
import { Logged, type Log } from "@/app/(tools)/gallery/_components/wiring";

/** A bounce Postmark won't send to again, which staff can't unblock. */
const stuck = { ...exampleBlock, canReset: false };

/** A stand-in for the Server Action: logs what its form sends, and answers that it's done. */
function logged(log: Log): Unblock {
  return (form) => {
    log("unblock")(form);
    return Promise.resolve({ ok: true });
  };
}

/** The unblock form for a bounce, logged, and what shows instead for a complaint and for a bounce Postmark won't resend. */
export function UnblockFormExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <UnblockForm block={exampleBlock} action={logged(log)} />
          <UnblockForm block={exampleComplaint} action={logged(log)} />
          <UnblockForm block={stuck} action={logged(log)} />
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
            action={logged(log)}
          />
          <UnblockBubble block={exampleComplaint} action={logged(log)} />
          <UnblockBubble block={stuck} action={logged(log)} />
        </>
      )}
    </Logged>
  );
}
