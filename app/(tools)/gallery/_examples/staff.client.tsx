"use client";

// The staff screens' examples whose Server Actions are props: client
// components with no props, each action logged rather than sent.
import ChangesFilters from "@/app/(staff)/staff/_components/ChangesFilters";
import { changesSearch } from "@/lib/staff-search";
import type { EmailBlock } from "@/lib/server/email.server";
import EmailBlocksTable from "@/app/(staff)/staff/_components/EmailBlocksTable";
import FilterBar from "@/app/(staff)/staff/_components/ui/FilterBar";
import Menu, { menuItemsClass } from "@/app/(staff)/staff/_components/ui/Menu";
import MenuSubmit from "@/app/(staff)/staff/_components/ui/MenuSubmit";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import { savedFiltersProps } from "@/app/(staff)/staff/_components/ui/SavedFilters";
import {
  exampleBlock,
  exampleComplaint,
  exampleGmailBlock,
} from "@/app/(staff)/staff/_components/EmailBlocksTable.examples";
import { ImportJobPage } from "@/app/(staff)/staff/_components/ImportJob";
import JobActions from "@/app/(staff)/staff/_components/JobActions";
import ErrorSeenView from "@/app/(staff)/staff/_components/ErrorSeenView";
import { exampleErrorDone, exampleErrorsSeen } from "@/app/(staff)/staff/_components/ErrorsSeen.examples";
import Run from "@/app/(staff)/staff/_components/Run";
import UnblockForm, { UnblockBubble } from "@/app/(staff)/staff/_components/UnblockForm";
import NoteChanges from "@/app/(staff)/staff/_components/NoteChanges";
import NotesCard from "@/app/(staff)/staff/_components/NotesCard";
import Notes, { NoteEntry, NoteText } from "@/app/(staff)/staff/_components/Notes";
import {
  exampleNoteAdmin,
  exampleNotes,
  exampleNotesAt,
  exampleNoteWriter,
} from "@/app/(staff)/staff/_components/Notes.examples";
import {
  exampleFailedRun,
  exampleHeldImport,
  exampleImportResult,
  exampleRun,
} from "@/app/(staff)/staff/_components/RunList.examples";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DeleteTwice } from "@/app/(staff)/staff/_components/DeleteTwice";
import Notice from "@/app/(staff)/staff/_components/ui/Notice";
import { Logged } from "../_components/wiring";

/** An MP sync held for a decision: apply and discard log what they'd send. */
export function HeldImportExample() {
  return <Logged>{(log) => <Run run={exampleHeldImport} decide={log("decide")} />}</Logged>;
}

/** Blocked addresses, a bounce and a complaint unless told otherwise, their unblocking logged. */
export function EmailBlocksTableExample({
  blocks = [exampleBlock, exampleGmailBlock, exampleComplaint],
  letterLinks = true,
}: {
  blocks?: EmailBlock[];
  letterLinks?: boolean;
}) {
  return (
    <Logged>{(log) => <EmailBlocksTable blocks={blocks} unblock={log("unblock")} letterLinks={letterLinks} />}</Logged>
  );
}

/** The unblock form for a bounce, logged, and what shows for a complaint instead. */
export function UnblockFormExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <UnblockForm block={exampleBlock} action={log("unblock")} />
          <UnblockForm block={exampleComplaint} action={log("unblock")} />
        </>
      )}
    </Logged>
  );
}

/**
 * A row's button that opens the bubble asking why, its form logged, and what
 * shows for a complaint instead. Its address is its own, as the bubble's ID
 * is made from it, and the table's example is on the same page.
 */
export function UnblockBubbleExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <UnblockBubble block={{ address: "bounced@parliament.example", canReset: true }} action={log("unblock")} />
          <UnblockBubble block={exampleComplaint} action={log("unblock")} />
        </>
      )}
    </Logged>
  );
}

/**
 * A supporter's notes, their forms logged, as Jo sees them, who can change
 * her newest; as an admin, who can delete any; or with none yet.
 */
export function NotesExample({ as = "writer" }: { as?: "writer" | "admin" | "empty" }) {
  return (
    <Logged>
      {(log) => (
        <Notes
          supporterId={1}
          notes={as === "empty" ? [] : exampleNotes}
          reader={as === "admin" ? exampleNoteAdmin : exampleNoteWriter}
          at={exampleNotesAt}
          add={log("add")}
          edit={log("edit")}
          remove={log("delete")}
        />
      )}
    </Logged>
  );
}

/** One note as a history shows it, labelled and without its time: Jo's, which she can change, or Sam's, edited, which she can't. */
export function NoteEntryExample({ own = true }: { own?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <NoteEntry
          note={exampleNotes[own ? 0 : 1]}
          reader={exampleNoteWriter}
          at={exampleNotesAt}
          edit={log("edit")}
          remove={log("delete")}
          label="Note"
          dated={false}
        />
      )}
    </Logged>
  );
}

/** A note's buttons, logged: Edit, which opens Save, Cancel and Delete, for its writer; Delete alone for an admin. */
export function NoteChangesExample({ editable = true }: { editable?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <NoteChanges
          note={exampleNotes[0]}
          editable={editable}
          text={<NoteText body={exampleNotes[0].body} />}
          meta="jo@pauseai.uk"
          edit={log("edit")}
          remove={log("delete")}
        />
      )}
    </Logged>
  );
}

/** A politician's history card, its Write a note logged: two lines, or none; or without Write a note. */
export function NotesCardExample({ lines = true, writable = true }: { lines?: boolean; writable?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <NotesCard
          target={{ name: "politicianId", value: 7 }}
          writer={exampleNoteWriter.email}
          add={writable ? log("add") : undefined}
        >
          {(lines ? ["Met them at the fair", "Asked for the one-pager"] : []).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </NotesCard>
      )}
    </Logged>
  );
}

/** A note's text, its addresses links, and its lines kept. */
export function NoteTextExample() {
  return <NoteText body={exampleNotes[0].body + "\n" + exampleNotes[1].body} />;
}

/** A job's page, its button and any held import's buttons logged: Parliament's import with three runs, while a run started by a staff member or its schedule is going, or the ControlAI import, never run. */
export function ImportJobPageExample({
  never = false,
  running,
}: {
  never?: boolean;
  /** Who started the run going now, if one is. */
  running?: string;
}) {
  return (
    <Logged>
      {(log) =>
        never ? (
          <ImportJobPage job="import-controlai" runs={[]} run={log("run")} decide={log("decide")} />
        ) : (
          <ImportJobPage
            job="import-parliament"
            running={running ? { startedBy: running, startedAt: new Date("2026-11-04T09:00:00Z") } : undefined}
            runs={[
              exampleRun("import-parliament", exampleImportResult, { id: 7, at: new Date("2026-11-03T06:21:00Z") }),
              exampleFailedRun("import-parliament", "Parliament answered 500", {
                id: 6,
                at: new Date("2026-11-02T06:21:00Z"),
              }),
              exampleRun("import-parliament", exampleImportResult, { id: 5, at: new Date("2026-11-01T06:21:00Z") }),
            ]}
            run={log("run")}
            decide={log("decide")}
          />
        )
      }
    </Logged>
  );
}

/** An import's button, its runs logged. */
export function JobActionsExample() {
  return <Logged>{(log) => <JobActions action={log("action")} label="Check now" />}</Logged>;
}

/** An error's page, its button logged: the examples' errors by their place in the list, or the one marked done. */
export function ErrorSeenViewExample({ which }: { which: 0 | 1 | 2 | "done" }) {
  const error = which === "done" ? exampleErrorDone : exampleErrorsSeen[which];
  return <Logged>{(log) => <ErrorSeenView error={error} setDone={log("setDone")} />}</Logged>;
}

/** A note, open, that its × closes, and opens again. */
export function NoticeExample() {
  const [open, setOpen] = useState(true);
  return (
    <span role="status">
      {open ? (
        <Notice close="Close" onClose={() => setOpen(false)}>
          Emailed sean@pauseai.uk and joseph@pauseai.uk to let them know sean@pauseai.uk now owns this event.
        </Notice>
      ) : (
        <Button variant="ghost" size="small" fit onClick={() => setOpen(true)}>
          Open it again
        </Button>
      )}
    </span>
  );
}

/** A delete pressed twice, logged; and one that can't be pressed. */
export function DeleteTwiceExample() {
  return (
    <Logged>
      {(log) => (
        <>
          <DeleteTwice name="slug" value="winter-reception-dec-2026" label="Delete ask" action={log("delete")} />
          <DeleteTwice name="slug" value="frontier-ai-letter" label="Delete ask" disabled action={log("delete")} />
        </>
      )}
    </Logged>
  );
}

/** A menu holding an item that sends a form, logged. */
export function MenuSubmitExample() {
  return (
    <Logged>
      {(log) => (
        <Menu id="example-menu-submit" label="Choose">
          <form action={log("update")} className={menuItemsClass}>
            <MenuSubmit>Update for everyone</MenuSubmit>
          </form>
        </Menu>
      )}
    </Logged>
  );
}

const SAVED_ROWS = [
  {
    id: 1,
    name: "A very long saved filter name that goes on past where the chip stops",
    params: { party: "Labour" },
    createdBy: "jane.smith@example.com",
    createdAt: new Date("2026-10-28T10:00:00Z"),
    changedAt: new Date("2026-10-28T10:00:00Z"),
  },
];

const SAVED_STATES = {
  none: { values: {}, loaded: undefined },
  unsaved: { values: { party: "Labour" }, loaded: undefined },
  loaded: { values: { party: "Labour", saved: "1" }, loaded: { edited: false, gone: [] } },
  edited: { values: { party: "Green", saved: "1" }, loaded: { edited: true, gone: [] } },
  gone: { values: { party: "Labour", saved: "1" }, loaded: { edited: false, gone: ["party=Reform Group"] } },
};

/** The audit log's filters: several of who chosen, one of what left out, and how recent. */
export function ChangesFiltersExample() {
  return (
    <Logged>
      {(log) => (
        <StaffPage as="div">
          <ChangesFilters
            search={changesSearch({ actor: ["jo@pauseai.uk", "sync"], action: "!add note", when: "30" })}
            choices={{ actors: ["jo@pauseai.uk", "sync"], actions: ["add note", "edit event"] }}
            actions={{ save: log("save"), update: log("update"), rename: log("rename"), remove: log("remove") }}
          />
        </StaffPage>
      )}
    </Logged>
  );
}

/** A filter bar with saved filters, in one of its states. */
export function SavedFilterExample({ state }: { state: keyof typeof SAVED_STATES }) {
  const { values, loaded } = SAVED_STATES[state];
  return (
    <Logged>
      {(log) => (
        <StaffPage as="div">
          <FilterBar
            path="#"
            values={values}
            search={{ name: "q", label: "Name" }}
            filters={[
              {
                name: "party",
                label: "Party",
                repeat: true,
                options: ["Labour", "Green"].map((party) => ({ value: party, label: party })),
              },
            ]}
            saved={savedFiltersProps({
              list: "politicians",
              state: {
                rows: SAVED_ROWS,
                params: values,
                loaded: loaded && { ...SAVED_ROWS[0], ...loaded },
              },
              values,
              path: "/staff/politicians",
              name: "Party: Labour",
              summary: (params) => [`Party ${params.party}`],
              actions: { save: log("save"), update: log("update"), rename: log("rename"), remove: log("remove") },
            })}
          />
        </StaffPage>
      )}
    </Logged>
  );
}

/** The same, with part of the filter gone, which the bar says under itself. */
export function SavedFilterGoneExample() {
  return <SavedFilterExample state="gone" />;
}
