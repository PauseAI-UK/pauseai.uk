"use client";

// CampaignLetterWriter's example, which logs what its buttons send (CampaignLetterWriter.gallery.tsx).
import CampaignLetterWriter from "./CampaignLetterWriter";
import {
  exampleAsks,
  exampleCampaignConditions,
  exampleCampaignDraft,
  exampleMps,
} from "./CampaignLetterWriter.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** The bill's draft letter, its actions logged; saves go through, as a draft's would. */
export function CampaignLetterWriterExample() {
  let version = exampleCampaignDraft.version;
  return (
    <Logged>
      {(log) => (
        <CampaignLetterWriter
          title="Support the Artificial Superintelligence Bill"
          draft={exampleCampaignDraft}
          mps={exampleMps}
          asks={exampleAsks}
          conditions={exampleCampaignConditions}
          actions={{
            save: async (...args) => {
              log("saveCampaignLetter")(...args);
              return { ok: true as const, version: ++version };
            },
            publish: async (...args) => {
              log("publishCampaignLetter")(...args);
              return { ok: true as const };
            },
            discard: async (...args) => {
              log("discardCampaignLetter")(...args);
              return { ok: true as const };
            },
          }}
        />
      )}
    </Logged>
  );
}
