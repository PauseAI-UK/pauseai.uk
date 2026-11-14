"use client";

// MyGmail's example that logs Disconnect (MyGmail.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import { exampleGmailAccount } from "../LetterThread.examples";
import MyGmail from "./MyGmail";

/** Your Gmail on your own page, connected or not, Disconnect logged. */
export function MyGmailExample({ connected, outcome = "" }: { connected: boolean; outcome?: string }) {
  return (
    <Logged>
      {(log) => (
        <MyGmail
          me="jo@pauseai.uk"
          account={connected ? exampleGmailAccount : undefined}
          outcome={outcome}
          disconnect={log("disconnect")}
        />
      )}
    </Logged>
  );
}
