"use client";

// PoliticianMarks's example that logs each marker's press (PoliticianMarks.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import PoliticianMarks from "./PoliticianMarks";
import { examplePolitician } from "./PoliticianTable.examples";

/** A politician's markers, each button's press logged: on, off, and for a test politician its tag. */
export function PoliticianMarksExample({ test = false }: { test?: boolean }) {
  return (
    <Logged>
      {(log) => <PoliticianMarks politician={{ ...examplePolitician, isTest: test }} setMark={log("setMark")} />}
    </Logged>
  );
}
