"use client";

// PartBox's example with its ×, which logs being pressed (PartBox.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import PartBox from "./PartBox";

export function ClosablePartExample() {
  return (
    <Logged>
      {(log) => (
        <PartBox label="Only for those who registered for “PauseCon London”" onForEveryone={log("onForEveryone")}>
          <p>We&apos;ll see you there on Saturday.</p>
        </PartBox>
      )}
    </Logged>
  );
}
