"use client";

// PoliticianDetails's example that logs its saves (PoliticianDetails.gallery.tsx).
import { exampleBlock } from "../oversight/BlocksTable.examples";
import { exampleLetter } from "../letters/LettersTable.examples";
import { exampleNotes, exampleNotesAt, exampleNoteWriter } from "../notes/Notes.examples";
import { Logged, loggedDone } from "@/app/(tools)/gallery/_components/wiring";
import PoliticianDetails from "./PoliticianDetails";
import { exampleAliases, examplePolitician, examplePoliticianHistory } from "./PoliticianTable.examples";
import { exampleAsks } from "../asks/AsksList.examples";

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
          setStatus={loggedDone(log, "setStatus")}
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
          unblock={loggedDone(log, "unblock")}
          aliases={aliases ? exampleAliases : undefined}
          aliasesOpen={aliases}
          aliasActions={{ add: loggedDone(log, "addAlias"), remove: loggedDone(log, "removeAlias") }}
          setMark={loggedDone(log, "setMark")}
          editDetails={loggedDone(log, "editDetails")}
          notes={
            fromAirtable
              ? undefined
              : {
                  notes: exampleNotes,
                  reader: exampleNoteWriter,
                  at: exampleNotesAt,
                  add: loggedDone(log, "addNote"),
                  edit: loggedDone(log, "editNote"),
                  remove: loggedDone(log, "deleteNote"),
                }
          }
        />
      )}
    </Logged>
  );
}
