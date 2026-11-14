"use client";

// PickBox's example that logs each click (PickBox.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import PickBox from "./PickBox";

/** A tick box that saves as it's clicked: ticked, not, and part ticked, the click logged. */
export function PickBoxExample() {
  return (
    <Logged>
      {(log) => (
        <div style={{ display: "flex", gap: "var(--space-4)" }}>
          <PickBox ticked label="Ticked" action={async (on) => log("pick")(on)} />
          <PickBox ticked={false} label="Not ticked" action={async (on) => log("pick")(on)} />
          <PickBox ticked={false} some label="Some ticked" action={async (on) => log("pick")(on)} />
        </div>
      )}
    </Logged>
  );
}
