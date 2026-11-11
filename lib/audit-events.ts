// What the audit log holds: each action, and the details logged with it.
// logChange (lib/server/audit.ts) writes only what AuditDetails says; the
// log's pages read StoredAuditDetails, which adds what rows logged earlier
// may still hold, as the log keeps a politician's history while they're here
// and everything else for a month (lib/server/log-retention.ts).
import type { AskStatus } from "./asks";
import type { BroadcastTerms } from "./broadcasts";
import type { FieldChange } from "./field-changes";
import type { SyncedPolitician } from "./politician-sync";
import type { SavedList } from "./saved-filters";
import type { DownloadFormat } from "./staff-list";
import type { Permission } from "./staff-permissions";
import type { Ask } from "./server/asks";
import type { DeliveryProblem } from "./server/email";
import type { ErasureResult } from "./server/erasure";
import type { MailingState } from "./server/mailing-drafts";
import type { NoteTarget } from "./server/notes";
import type { House } from "./server/politicians";

/** How many a sync or import added, removed or changed. */
type SyncCounts = { added: number; removed: number; changed: number };

/** A download of a list: its filters in words, its format, how many rows, and a vCard file's code. */
type DownloadDetails = { filters: string[]; format: DownloadFormat; rows: number; code?: string };

/** A politician added by hand or by a signatory import, with their ID. */
type HandAddedPolitician = {
  id: number;
  house: House;
  name: string;
  salutation: string;
  constituency: string | null;
  party: string;
  email: string | null;
};

/** An MP as the MP sync copied them, with their ID. */
type SyncedMp = {
  id: number;
  airtableId: string;
  house: "commons";
  name: string;
  salutation: string;
  constituency: string;
  party: string;
  email: string | null;
};

/** What an edit changed, each field before and after, with whom it's about. */
type PoliticianEdit = { id: number; name: string; changed: Record<string, FieldChange> };

/** The actions on a politician's addresses, by `politicianId`: part of their history. */
export const ADDRESS_ACTIONS = ["add politician address", "remove politician address"] as const;

/** What a list's download is logged as (staffDownload). */
export type DownloadAction = "download supporters" | "download blocked emails";

/** Each action logChange logs, and its details. */
export type AuditDetails = { [A in DownloadAction]: DownloadDetails } & {
  "set status": { politicianId: number; ask: string; status: AskStatus | null; date: string | null; note: string };
  "add politician": { id: number } & SyncedPolitician;
  "edit politician": PoliticianEdit & { airtableId: string };
  "remove politician": { id: number; name: string };
  "delete politician": { id: number; name: string; airtableId: string };
  "add politician address": { politicianId: number; address: string };
  "remove politician address": { politicianId: number; address: string };
  "apply politician sync": SyncCounts;
  "hold politician sync": SyncCounts;
  "apply held politician sync": { id: number };
  "discard held politician sync": { id: number };
  "import ControlAI letter": { added: number; removed: number; problems: number };
  "import web form letters": { imported: number; skipped: number; alreadyHere: number; noPolitician: number };
  "import sign-ups": { uploadId: number; imported: number; heldBack: number };
  "copy PauseAI emails": { added: number };
  "add ask": Ask;
  "edit ask": Ask;
  "delete ask": Ask;
  "add note": { noteId: number } & NoteTarget;
  "edit note": { noteId: number } & NoteTarget;
  "delete note": { noteId: number } & NoteTarget;
  "save filter": { id: number; list: SavedList };
  "update filter": { id: number; list: SavedList };
  "rename filter": { id: number; list: SavedList };
  "delete filter": { id: number; list: SavedList };
  "erase supporter": { id: number; reference: string } & Omit<ErasureResult, "notCleared">;
  "add staff account": { email: string; to: Permission[] };
  "set staff permissions": { email: string; from: Permission[]; to: Permission[] };
  "remove staff account": { email: string; permissions: Permission[] };
  "end staff sessions": { email: string; sessions: number };
  "connect gmail": { email: string };
  "disconnect gmail": { email: string; why: string };
  "block address": { address: string; kind: DeliveryProblem["kind"] };
  "unblock address": { address: string; note: string };
  "set event owner": { eventId: string; owner: string; previous: string | null };
  "set event doc": { eventId: string; url: string | null; previous: string | null };
  "create mailing": { id: number };
  "schedule mailing": { id: number; recipients: number };
  "reschedule mailing": { id: number; dueAt: string };
  "stop mailing": { id: number; was: MailingState };
  "delete mailing": { id: number };
  "start mailing": { id: number };
  "finish mailing": { id: number };
  "create broadcast": { id: number } & BroadcastTerms;
  "change broadcast consent": { id: number } & BroadcastTerms;
  "submit broadcast template": { id: number; name: string };
  "withdraw broadcast template": { id: number };
  "schedule broadcast": { id: number; recipients: number };
  "stop broadcast": { id: number; was: MailingState };
};

/** What rows logged earlier may hold beyond AuditDetails: actions no longer logged, and earlier details of some that are. */
type EarlierAuditDetails = {
  // By campaign, before asks; "supports" was a status then.
  "set status": {
    politicianId: number;
    campaign: string;
    status: "signed" | "supports" | null;
    date: string | null;
    note: string;
  };
  "add politician":
    | HandAddedPolitician
    | SyncedMp
    | ({ id: number } & SyncedPolitician & { forename?: string | null; surname?: string | null; city?: string | null });
  "edit politician": HandAddedPolitician | SyncedMp | PoliticianEdit;
  // Before the sync read every body: the MPs alone.
  "apply MP sync": SyncCounts;
  "hold MP sync": SyncCounts;
  "apply held MP sync": { id: number };
  "discard held MP sync": { id: number };
  "import signatories from Airtable": { matched: number; added: number; alreadySet: number };
  // What a migration took away when "supports" stopped being a status.
  "remove supports status": {
    politicianId: number;
    campaign: string;
    statusDate: string | null;
    note: string;
    updatedBy: string;
    updatedAt: string;
  };
  // Before each count of what went with them was logged.
  "erase supporter": { id: number; reference: string; lumaUsers: number; letters: number } & Partial<
    Omit<ErasureResult, "notCleared"> & { lumaFailed: string[] }
  >;
  "view supporter": { id: number };
  "download letters": DownloadDetails;
};

/** Every action the audit log may hold. */
export type AuditAction = keyof AuditDetails | keyof EarlierAuditDetails;

/** Each action's details as the audit log may hold them: as logged now, or earlier. */
export type StoredAuditDetails = {
  [A in AuditAction]:
    | (A extends keyof AuditDetails ? AuditDetails[A] : never)
    | (A extends keyof EarlierAuditDetails ? EarlierAuditDetails[A] : never);
};

/** An entry of the audit log: an action with its details. */
export type AuditEvent = { [A in AuditAction]: { action: A; details: StoredAuditDetails[A] } }[AuditAction];
