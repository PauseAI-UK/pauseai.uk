"use client";

// TextButtons' examples, which change as they're used (TextButtons.gallery.tsx).
import { Controlled } from "@/app/(tools)/gallery/_components/wiring";
import type { TextButton } from "@/lib/broadcasts/text-parts";
import TextButtons from "./TextButtons";

export function TextButtonsExample({ initial, fixed = false }: { initial: TextButton[]; fixed?: boolean }) {
  return (
    <Controlled initial={initial} show={(buttons) => JSON.stringify(buttons)}>
      {(buttons, set) => <TextButtons buttons={buttons} onChange={set} fixed={fixed} />}
    </Controlled>
  );
}
