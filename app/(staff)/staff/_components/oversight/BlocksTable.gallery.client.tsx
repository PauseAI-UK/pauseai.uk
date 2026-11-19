"use client";

// BlocksTable's examples, whose unblocking is logged (BlocksTable.gallery.tsx).
import type { Block } from "@/lib/oversight/blocks.server";
import BlocksTable from "./BlocksTable";
import { BLOCKED_ADDRESSES_LIST } from "@/lib/staff-lists";
import {
  exampleBlock,
  exampleBroadcastBlock,
  exampleComplaint,
  exampleGmailBlock,
  exampleHold,
  exampleMailboxBlock,
  exampleNumber,
  listed,
} from "./BlocksTable.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** Every kind of block a supporters' list holds. */
export const supportersBlocks: Block[] = [
  exampleBroadcastBlock,
  exampleNumber,
  listed(exampleComplaint),
  exampleHold,
  exampleMailboxBlock,
];

/** Blocked addresses, politicians' unless told otherwise, their unblocking logged; `total` of them, over pages. */
export function BlocksTableExample({
  blocks = [listed(exampleBlock), listed(exampleGmailBlock)],
  letterLinks = true,
  total = blocks.length,
  page = 1,
}: {
  blocks?: Block[];
  letterLinks?: boolean;
  total?: number;
  page?: number;
}) {
  return (
    <Logged>
      {(log) => (
        <BlocksTable
          list={{ total, blocks }}
          page={page}
          of={BLOCKED_ADDRESSES_LIST}
          search={BLOCKED_ADDRESSES_LIST.read({})}
          unblock={log("unblock")}
          letterLinks={letterLinks}
        />
      )}
    </Logged>
  );
}
