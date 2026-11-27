"use client";

// TextVersions' examples, whose tabs switch and whose × logs (TextVersions.gallery.tsx).
import { useState } from "react";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import TextVersions, { type VersionSide } from "./TextVersions";

export function TextVersionsExample({ templates }: { templates: number }) {
  const [open, setOpen] = useState<VersionSide>("only");
  return (
    <Logged>
      {(log) => (
        <TextVersions
          who="registered for “PauseAI London March”"
          counts={{ only: 318, except: 94 }}
          open={open}
          onOpen={setOpen}
          templates={templates}
          onRemove={log("onRemove")}
        >
          <p>{open === "only" ? "We meet at All Souls' Place at noon." : "Over 1,800 people are coming. Will you?"}</p>
        </TextVersions>
      )}
    </Logged>
  );
}
