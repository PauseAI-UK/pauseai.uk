"use client";

// NewCampaignWriter's example, which logs what Make the campaign sends (NewCampaignWriter.gallery.tsx).
import { greetingLetter } from "@/lib/mailings/doc";
import NewCampaignWriter from "./NewCampaignWriter";
import { exampleAsks, exampleCampaignConditions, exampleMps } from "./CampaignLetterWriter.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** A new campaign, its letter started as the page starts it. */
export function NewCampaignWriterExample() {
  return (
    <Logged>
      {(log) => (
        <NewCampaignWriter
          start={{ subject: "", body: greetingLetter("Dear", "salutation") }}
          mps={exampleMps}
          asks={exampleAsks}
          conditions={exampleCampaignConditions}
          create={async (form) => {
            log("newCampaign")(Object.fromEntries(form));
            return { ok: true as const };
          }}
        />
      )}
    </Logged>
  );
}
