"use client";

// SignupKindChoice's example, which can be clicked (SignupKindChoice.gallery.tsx).
import { useState } from "react";
import type { SignupKind } from "@/lib/supporters/signup-csv";
import SignupKindChoice from "./SignupKindChoice";

/** The choice, paper picked to start with. */
export function SignupKindChoiceExample() {
  const [kind, setKind] = useState<SignupKind>("paper");
  return <SignupKindChoice value={kind} onChange={setKind} />;
}
