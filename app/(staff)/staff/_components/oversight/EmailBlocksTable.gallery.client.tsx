"use client";

// EmailBlocksTable's examples, whose unblocking is logged (EmailBlocksTable.gallery.tsx).
import type { EmailBlock } from "@/lib/email/email.server";
import EmailBlocksTable from "./EmailBlocksTable";
import { exampleBlock, exampleComplaint, exampleGmailBlock } from "./EmailBlocksTable.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** Blocked addresses, a bounce and a complaint unless told otherwise, their unblocking logged. */
export function EmailBlocksTableExample({
  blocks = [exampleBlock, exampleGmailBlock, exampleComplaint],
  letterLinks = true,
}: {
  blocks?: EmailBlock[];
  letterLinks?: boolean;
}) {
  return (
    <Logged>{(log) => <EmailBlocksTable blocks={blocks} unblock={log("unblock")} letterLinks={letterLinks} />}</Logged>
  );
}
