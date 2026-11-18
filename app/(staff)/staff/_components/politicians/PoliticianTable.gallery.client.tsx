"use client";

// PoliticianTable's examples (PoliticianTable.gallery.tsx).
import type { Politician } from "@/lib/politicians/records.server";
import PoliticianTable from "./PoliticianTable";
import { examplePolitician } from "./PoliticianTable.examples";
import { exampleAsks } from "../asks/AsksList.examples";

/** The table of politicians: one function for every example, filtered by `ask` if given. */
function LoggedPoliticianTable({ politicians, ask }: { politicians: Politician[]; ask?: string }) {
  return <PoliticianTable politicians={politicians} asks={exampleAsks} search={ask ? { ask } : {}} />;
}

/**
 * The list filtered by the conference: one who declined it, one a letter
 * invited to it who hasn't answered, and one never invited.
 */
export function PoliticianTableByAskExample() {
  const conference = exampleAsks[0]!.slug;
  return (
    <LoggedPoliticianTable
      ask={conference}
      politicians={[
        examplePolitician,
        {
          ...examplePolitician,
          id: 8,
          name: "Wendy Written",
          statuses: {},
          askedByLetter: { [conference]: new Date("2026-10-12T09:00:00Z") },
        },
        { ...examplePolitician, id: 9, name: "Neil Never", statuses: {} },
      ]}
    />
  );
}

/** An MP who signed the letter to the PM, and a test peer, retired, whose address is blocked, who signed ControlAI's letter. */
export function PoliticianTableExample() {
  return (
    <LoggedPoliticianTable
      politicians={[
        examplePolitician,
        {
          ...examplePolitician,
          id: 8,
          name: "Testy McTestface MP",
          isTest: true,
          status: "retired",
          emailBlocked: true,
          house: "lords",
          constituency: null,
          statuses: {
            "controlai-letter": { ...examplePolitician.statuses["frontier-ai-letter"], updatedBy: "controlai" },
          },
        },
      ]}
    />
  );
}

/** No politician matches the filter. */
export function PoliticianTableEmptyExample() {
  return <LoggedPoliticianTable politicians={[]} />;
}
