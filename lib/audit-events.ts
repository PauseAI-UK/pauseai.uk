// What the audit log holds: each action, and the details logged with it.
// logChange (lib/server/audit.ts) writes only what AuditDetails says; the
// log's pages read StoredAuditDetails, which adds what rows logged earlier
// may still hold, as the log keeps a politician's history while they're here
// and everything else for a month (lib/server/log-retention.ts).
import type { AskStatus } from "@/lib/asks/asks";
import type { BroadcastTerms } from "./broadcasts";
import type { FieldChange } from "./field-changes";
import type { PoliticianImportJob } from "./import-runs";
import type { ImportedFields } from "@/lib/politicians/import-changes";
import type { SavedList } from "./saved-filters";
import type { DownloadFormat } from "./staff-list";
import type { Permission } from "@/lib/accounts/permissions";
import type { Ask } from "@/lib/asks/records";
import type { DeliveryProblem } from "./server/email";
import type { ErasureResult } from "@/lib/erasure/erase";
import type { MailingState } from "@/lib/mailings/drafts";
import type { NoteTarget } from "./server/notes";
import type { House } from "@/lib/politicians/records";

/** How many a sync added, removed or changed. */
type SyncCounts = { added: number; removed: number; changed: number };

/** Which body's import, and how many politicians it added, found had left, or changed. */
type ImportCounts = { job: PoliticianImportJob; added: number; left: number; changed: number };

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

/** A politician as the sync copied them from Airtable, by their record. */
type SyncedPolitician = {
  airtableId: string;
  name: string;
  salutation: string;
  email: string | null;
  status: "in_office" | "died" | "retired" | "left_office";
  house: "commons" | "lords" | "scottish-parliament" | "senedd" | "ni-assembly" | "other";
  constituency: string | null;
  party: string;
  country: "england" | "scotland" | "wales" | "northern-ireland" | null;
  notes: string;
  importantTarget: boolean;
  personalConnection: boolean;
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
  /** By an import, from their body's list. */
  "add politician": { id: number } & ImportedFields;
  /** An import's or a staff member's edit; an import's change of status, with when it happened and why. */
  "edit politician": PoliticianEdit & { date?: string | null; note?: string };
  "add politician address": { politicianId: number; address: string };
  "remove politician address": { politicianId: number; address: string };
  "apply politician import": ImportCounts;
  "hold politician import": ImportCounts;
  "apply held politician import": { id: number; job: PoliticianImportJob };
  "discard held politician import": { id: number; job: PoliticianImportJob };
  "import ControlAI letter": { added: number; removed: number; problems: number };
  "import sign-ups": { uploadId: number; imported: number; heldBack: number };
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
  "resume broadcast": { id: number; copies: number };
  "record opt-out": { address: string; list: string; way: string; how: string; replyId?: number };
  "deal with reply": { replyId: number; outcome: "opted-out" | "nothing" };
  "answer reply": { replyId: number; answerId: number };
};

/** What rows logged earlier may hold beyond AuditDetails: actions no longer logged, and earlier details of some that are. */
type EarlierAuditDetails = {
  // From when a politician gone from Airtable was marked so, and staff could delete them.
  "remove politician": { id: number; name: string };
  "delete politician": { id: number; name: string; airtableId: string };
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
  "edit politician": HandAddedPolitician | SyncedMp | (PoliticianEdit & { airtableId: string });
  // From when the sync copied every politician from Airtable.
  "apply politician sync": SyncCounts;
  "hold politician sync": SyncCounts;
  "apply held politician sync": { id: number };
  "discard held politician sync": { id: number };
  // Before the sync read every body: the MPs alone.
  "apply MP sync": SyncCounts;
  "hold MP sync": SyncCounts;
  "apply held MP sync": { id: number };
  "discard held MP sync": { id: number };
  "import signatories from Airtable": { matched: number; added: number; alreadySet: number };
  // From the one-off imports of pauseai.info's web form letters and PauseAI's emails from Airtable.
  "import web form letters": { imported: number; skipped: number; alreadyHere: number; noPolitician: number };
  "copy PauseAI emails": { added: number };
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
