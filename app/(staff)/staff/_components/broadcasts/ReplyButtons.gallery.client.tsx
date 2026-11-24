"use client";

// ReplyButtons' examples, which change as they're used (ReplyButtons.gallery.tsx).
import { Controlled } from "@/app/(tools)/gallery/_components/wiring";
import type { ReplyButton } from "@/lib/broadcasts/text-parts";
import ReplyButtons from "./ReplyButtons";

export function ReplyButtonsExample({ initial, fixed = false }: { initial: ReplyButton[]; fixed?: boolean }) {
  return (
    <Controlled initial={initial} show={(buttons) => JSON.stringify(buttons)}>
      {(buttons, set) => <ReplyButtons buttons={buttons} onChange={set} fixed={fixed} />}
    </Controlled>
  );
}
