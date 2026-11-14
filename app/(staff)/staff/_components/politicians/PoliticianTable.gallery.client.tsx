"use client";

// PoliticianTable's examples (PoliticianTable.gallery.tsx).
import type { Politician } from "@/lib/politicians/records.server";
import PoliticianTable from "./PoliticianTable";
import { examplePolitician } from "./PoliticianTable.examples";
import { exampleAsks } from "../asks/AsksList.examples";

/** The table of politicians: one function for both examples. */
function LoggedPoliticianTable({ politicians }: { politicians: Politician[] }) {
  return <PoliticianTable politicians={politicians} asks={exampleAsks} />;
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
