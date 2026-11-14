"use client";

// MailingFor's examples, which log what its buttons send (MailingFor.gallery.tsx).
import MailingFor from "./MailingFor";
import { exampleWriterData, exampleWrittenMailing } from "./MailingWriter.examples";
import { exampleMailing } from "./MailingsTable.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import { exampleAsks } from "../asks/AsksList.examples";

import { mailingActions } from "./MailingWriter.gallery.client";

/** A mailing's page as it stands: a draft, or one sent. */
export function MailingForExample({ kind }: { kind: "draft" | "written" }) {
  return (
    <Logged>
      {(log) => (
        <MailingFor
          data={
            kind === "draft"
              ? { kind, draft: exampleWrittenMailing, ...exampleWriterData }
              : {
                  kind,
                  mailing: exampleMailing,
                  written: { ...exampleWrittenMailing, state: "sent" },
                  filter: exampleWriterData.filter,
                  parties: exampleWriterData.parties,
                  asks: exampleAsks,
                  names: {},
                }
          }
          actions={mailingActions(log)}
        />
      )}
    </Logged>
  );
}
