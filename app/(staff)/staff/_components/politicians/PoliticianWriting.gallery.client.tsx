"use client";

// PoliticianWriting's examples that log each change (PoliticianWriting.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import type { EditResult } from "@/lib/politicians/edits.server";
import { exampleAliases, examplePolitician } from "./PoliticianTable.examples";
import { AddressesBubble, SalutationBubble } from "./PoliticianWriting";

/** A politician's salutation in the band, each save logged, answering with `result`; one made from their name, with the two it most likely is. */
export function SalutationBubbleExample({ result, fromName = false }: { result: EditResult; fromName?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <SalutationBubble
          politician={
            fromName
              ? { ...examplePolitician, salutation: examplePolitician.name, salutationToCheck: true }
              : examplePolitician
          }
          action={(form) => {
            log("editDetails")(form);
            return result;
          }}
        />
      )}
    </Logged>
  );
}

/** A politician's email in the band, its bubble of their other addresses open, each change logged; a Lord's with none, to set. */
export function AddressesBubbleExample({ result, lord = false }: { result: EditResult; lord?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <AddressesBubble
          politician={
            lord
              ? { ...examplePolitician, name: "Lord Seedling", salutation: "Lord Seedling", email: null }
              : examplePolitician
          }
          aliases={lord ? { ...exampleAliases, email: null } : exampleAliases}
          actions={{ add: log("addAlias"), remove: log("removeAlias") }}
          setEmail={
            lord
              ? (form) => {
                  log("editDetails")(form);
                  return result;
                }
              : undefined
          }
          open
        />
      )}
    </Logged>
  );
}
