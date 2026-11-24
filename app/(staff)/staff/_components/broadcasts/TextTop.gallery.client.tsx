"use client";

// TextTop's examples, which change as they're used and log finding places (TextTop.gallery.tsx).
import { Controlled, Logged } from "@/app/(tools)/gallery/_components/wiring";
import type { TextHeader, TextPlace } from "@/lib/broadcasts/text-parts";
import TextTop from "./TextTop";
import { examplePlace } from "./BroadcastWriter.examples";

type Top = { header: TextHeader | null; place: TextPlace | null };

export function TextTopExample({ initial, fixed = false }: { initial: Top; fixed?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <Controlled initial={initial} show={(top) => JSON.stringify(top)}>
          {(top, set) => (
            <TextTop
              header={top.header}
              place={top.place}
              onChange={(change) => set({ ...top, ...change })}
              findPlaces={async (input) => {
                log("findPlaces")(input);
                return [examplePlace, { ...examplePlace, name: "Parliament Square Garden" }];
              }}
              fixed={fixed}
            />
          )}
        </Controlled>
      )}
    </Logged>
  );
}
