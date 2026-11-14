"use client";

// EraseForm's example that logs its Server Action (EraseForm.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import EraseForm from "./EraseForm";

/** The erase page's form, its Erase logged. */
export function EraseFormExample() {
  return (
    <Logged>
      {(log) => <EraseForm supporter={{ id: 7, name: "Jane Example" }} action={log("eraseSupporterNow")} />}
    </Logged>
  );
}
