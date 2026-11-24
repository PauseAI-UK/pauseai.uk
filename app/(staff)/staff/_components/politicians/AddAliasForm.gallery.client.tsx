"use client";

// AddAliasForm's example that logs the address added (AddAliasForm.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import AddAliasForm, { type AddAliasAction } from "./AddAliasForm";
import { examplePolitician } from "./PoliticianTable.examples";

/** The form that adds an address to a politician's, logged, answering with `result`. */
export function AddAliasFormExample({ result }: { result: Awaited<ReturnType<AddAliasAction>> }) {
  return (
    <Logged>
      {(log) => (
        <AddAliasForm
          politicianId={examplePolitician.id}
          action={(form) => {
            log("addAlias")(form);
            return Promise.resolve(result);
          }}
        />
      )}
    </Logged>
  );
}
