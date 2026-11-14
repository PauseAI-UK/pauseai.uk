"use client";

// PoliticianDetails's example that logs its saves (PoliticianDetails.gallery.tsx).
import { exampleBlock } from "@/app/(staff)/staff/_components/EmailBlocksTable.examples";
import { exampleLetter } from "@/app/(staff)/staff/_components/LettersTable.examples";
import { exampleNotes, exampleNotesAt, exampleNoteWriter } from "@/app/(staff)/staff/_components/Notes.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import PoliticianDetails from "./PoliticianDetails";
import { exampleAliases, examplePolitician, examplePoliticianHistory } from "./PoliticianTable.examples";
import { exampleAsks } from "../campaigns/AsksList.examples";

/**
 * A politician's page for a signer the policy team added, its saves logged;
 * or one of Airtable's MPs, not editable here, whose address may be blocked.
 */
export function PoliticianDetailsExample({
  fromAirtable = false,
  blocked = false,
  senders = true,
  aliases = false,
}: {
  fromAirtable?: boolean;
  blocked?: boolean;
  /** Whether the letters say who wrote them, as for staff with the supporters permission. */
  senders?: boolean;
  /** Whether their aliases are at the foot of the page, open. */
  aliases?: boolean;
}) {
  const letter = { ...exampleLetter, mpName: examplePolitician.name, politicianId: examplePolitician.id };
  return (
    <Logged>
      {(log) => (
        <PoliticianDetails
          politician={
            fromAirtable ? { ...examplePolitician, emailBlocked: blocked } : { ...examplePolitician, airtableId: null }
          }
          asks={exampleAsks}
          setStatus={log("setStatus")}
          block={blocked ? { ...exampleBlock, address: examplePolitician.email! } : undefined}
          letters={
            senders
              ? { senders, letters: [letter] }
              : {
                  senders,
                  letters: [
                    {
                      id: letter.id,
                      campaign: letter.campaign,
                      campaignTitle: letter.campaignTitle,
                      status: letter.status,
                      createdAt: letter.createdAt,
                      repliedAt: letter.repliedAt,
                    },
                  ],
                }
          }
          history={examplePoliticianHistory}
          unblock={log("unblock")}
          aliases={aliases ? exampleAliases : undefined}
          aliasesOpen={aliases}
          aliasActions={{ add: log("addAlias"), remove: log("removeAlias") }}
          setMark={log("setMark")}
          editDetails={async (form) => (log("editDetails")(form), { saved: true })}
          notes={
            fromAirtable
              ? undefined
              : {
                  notes: exampleNotes,
                  reader: exampleNoteWriter,
                  at: exampleNotesAt,
                  add: log("addNote"),
                  edit: log("editNote"),
                  remove: log("deleteNote"),
                }
          }
        />
      )}
    </Logged>
  );
}
