"use client";

// AskRow's examples, which log the answers set (AskRow.gallery.tsx).
import { Logged, loggedDone } from "@/app/(tools)/gallery/_components/wiring";
import { exampleAsks } from "../asks/AsksList.examples";
import AskRow, { AskRows, PoliticianAsks } from "./AskRow";
import { examplePolitician } from "./PoliticianTable.examples";

/**
 * The asks card's rows: one answered from Airtable, one staff record that
 * they were never asked, or, with `declined`, a letter they declined, or,
 * with `invited`, one a letter put to them, in the place of the first, and
 * one staff marked them asked; then, with `others`, the button whose menu
 * adds another.
 */
export function AskRowExample({
  others = false,
  declined = false,
  invited = false,
}: {
  others?: boolean;
  declined?: boolean;
  invited?: boolean;
}) {
  const signed = examplePolitician.statuses["frontier-ai-letter"]!;
  const record = declined
    ? { ...signed, status: "declined" as const }
    : { ...signed, status: "invited" as const, note: "Asked at their surgery" };
  const politician = {
    ...examplePolitician,
    airtableId: null,
    statuses:
      declined || invited
        ? { ...(invited ? {} : examplePolitician.statuses), [exampleAsks[4]!.slug]: record }
        : examplePolitician.statuses,
    askedByLetter: invited ? { [exampleAsks[0]!.slug]: new Date("2026-10-12T09:00:00Z") } : {},
  };
  return (
    <Logged>
      {(log) =>
        others ? (
          <PoliticianAsks politician={politician} asks={exampleAsks} setStatus={loggedDone(log, "setStatus")} />
        ) : (
          <AskRows>
            <AskRow politician={politician} ask={exampleAsks[0]!} setStatus={loggedDone(log, "setStatus")} />
            <AskRow politician={politician} ask={exampleAsks[4]!} setStatus={loggedDone(log, "setStatus")} />
          </AskRows>
        )
      }
    </Logged>
  );
}
