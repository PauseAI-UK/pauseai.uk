"use client";

// AskRow's examples, which log the answers set (AskRow.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import { exampleAsks } from "../campaigns/AsksList.examples";
import AskRow, { AskRows, PoliticianAsks } from "./AskRow";
import { examplePolitician } from "./PoliticianTable.examples";

/**
 * The asks card's rows: one answered from Airtable, one staff record with
 * no answer yet, or, with `declined`, a letter they declined; then, with
 * `others`, the button whose menu adds another.
 */
export function AskRowExample({ others = false, declined = false }: { others?: boolean; declined?: boolean }) {
  const decline = { ...examplePolitician.statuses["frontier-ai-letter"]!, status: "declined" as const };
  const politician = {
    ...examplePolitician,
    airtableId: null,
    statuses: declined
      ? { ...examplePolitician.statuses, [exampleAsks[4]!.slug]: decline }
      : examplePolitician.statuses,
  };
  return (
    <Logged>
      {(log) =>
        others ? (
          <PoliticianAsks politician={politician} asks={exampleAsks} setStatus={log("setStatus")} />
        ) : (
          <AskRows>
            <AskRow politician={politician} ask={exampleAsks[0]!} setStatus={log("setStatus")} />
            <AskRow politician={politician} ask={exampleAsks[4]!} setStatus={log("setStatus")} />
          </AskRows>
        )
      }
    </Logged>
  );
}
