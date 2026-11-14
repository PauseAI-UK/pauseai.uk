"use client";

// DeleteTwice's examples that keep state or log what's pressed (DeleteTwice.gallery.tsx).
import { DeleteTwice } from "./DeleteTwice";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** A delete pressed twice, logged; and one that can't be pressed. */
export function DeleteTwiceExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <DeleteTwice name="slug" value="winter-reception-dec-2026" label="Delete ask" action={log("delete")} />
          <DeleteTwice name="slug" value="frontier-ai-letter" label="Delete ask" disabled action={log("delete")} />
        </>
      )}
    </Logged>
  );
}
