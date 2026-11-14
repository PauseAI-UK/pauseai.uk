"use client";

// AskForm's examples, which log a save or a delete (AskForm.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import AskForm from "./AskForm";
import { exampleEditableAsk } from "./AsksList.examples";

/** An ask's form: a new one, one staff added, one answered, or one the code names; saves and deletes logged. */
export function AskFormExample({ ask, notice = "" }: { ask: "new" | "added" | "answered" | "named"; notice?: string }) {
  const asks = {
    new: null,
    added: exampleEditableAsk,
    answered: { ...exampleEditableAsk, kindFixed: true, deletable: false },
    named: {
      ...exampleEditableAsk,
      slug: "frontier-ai-letter",
      title: "Frontier AI letter",
      named: true,
      kindFixed: true,
      deletable: false,
    },
  };
  return (
    <Logged>
      {(log) => (
        <AskForm ask={asks[ask]} back="/staff/asks" notice={notice} save={log("save")} remove={log("delete")} />
      )}
    </Logged>
  );
}
