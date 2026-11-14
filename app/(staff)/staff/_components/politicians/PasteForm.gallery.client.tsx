"use client";

// PasteForm's example that logs the names pasted (PasteForm.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import PasteForm from "./PasteForm";

/** The box for names to paste, and Find these, logged; Ctrl+Enter or Cmd+Enter sends it too. */
export function PasteFormExample() {
  return (
    <Logged>
      {(log) => (
        <PasteForm action={log("pasteNames") as (form: FormData) => void} back="/staff/politicians?mailing=12" />
      )}
    </Logged>
  );
}
