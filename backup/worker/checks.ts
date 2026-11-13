import type { DumpReport, TimestampColumns } from "../container/backup.ts";
import type { MessagesReport } from "../container/messages.ts";

// What a good backup looks like, checked after every run against what the
// dump holds and against the backup before it.

export interface TableRule {
  /** The column whose latest value is the table's newest row. */
  timestamp?: string;
  /** The newest row must be at most this old when the backup is taken. */
  newWithinHours?: number;
  /** Rows are hardly ever deleted, so fewer than last time is probably data lost. */
  neverShrinks?: boolean;
  minRows?: number;
}

export const RULES: Record<string, TableRule> = {
  // The nightly MP sync records a run every night, even when nothing
  // changed, so a backup without last night's run is missing data. The daily
  // tidying (lib/server/log-retention.ts) deletes old runs, and old audit log
  // entries, so neither table only grows.
  import_runs: { timestamp: "at", newWithinHours: 36 },
  // A letter goes, with its events, only when a scheduled mailing is
  // stopped, a letter to an MP fails to send, or a supporter is erased.
  letters: { timestamp: "created_at", neverShrinks: true },
  letter_events: { timestamp: "at", neverShrinks: true },
  audit_log: { timestamp: "at" },
  // The House of Commons has 650 seats.
  politicians: { minRows: 600 },
};

/** A dump shrinking by more than this fraction since the last backup is a problem. */
const MAX_SHRINK = 0.2;

/** The messages' archive as the manifest records it: its key in the bucket, and what the container said of it. */
export interface MessagesManifest extends MessagesReport {
  key: string;
}

/** The record kept beside each dump. */
export interface Manifest extends DumpReport {
  /** When the backup was taken, as an ISO timestamp. */
  at: string;
  /** The dump's key in the bucket. */
  key: string;
  /** The messages' archive; missing where it couldn't be made, or the backup is from before there was one. */
  messages?: MessagesManifest;
}

/** Each rule's timestamp column, for the container to find the newest rows. */
export function timestampColumns(rules: Record<string, TableRule>): TimestampColumns {
  const columns: TimestampColumns = {};
  for (const [table, rule] of Object.entries(rules)) if (rule.timestamp) columns[table] = rule.timestamp;
  return columns;
}

/** How many of the messages a problem lists it names. */
const NAMED = 5;

/** The first few of a list of messages, and how many more. */
const named = (list: string[]): string =>
  `${list.slice(0, NAMED).join(", ")}${list.length > NAMED ? `, and ${list.length - NAMED} more` : ""}`;

/**
 * What's wrong with the messages' archive: messages the site listed but
 * had none for, messages it couldn't fetch tonight, and fewer messages by
 * more than MAX_SHRINK than the backup before. A missing archive is told where it failed (run.ts).
 */
function messageProblems(
  messages: MessagesManifest | undefined,
  previous: MessagesManifest | undefined,
  since: string,
): string[] {
  if (!messages) return [];
  const found: string[] = [];
  if (messages.missing.length) {
    found.push(`${messages.missing.length} of the site's messages weren't in its store: ${named(messages.missing)}.`);
  }
  if (messages.failed.length) {
    found.push(
      `${messages.failed.length} messages couldn't be fetched from the site, so aren't in tonight's archive; the next night tries them again: ${named(messages.failed)}.`,
    );
  }
  if (previous && messages.messages < previous.messages * (1 - MAX_SHRINK)) {
    found.push(`The messages' archive has ${messages.messages} messages, down from ${previous.messages}${since}.`);
  }
  return found;
}

/** What's wrong with this backup, one line each. Empty if nothing is. */
export function problems(
  manifest: Manifest,
  previous: Manifest | undefined,
  rules: Record<string, TableRule>,
): string[] {
  const found: string[] = [];
  const since = previous ? ` in the backup of ${previous.at}` : "";
  if (previous && manifest.bytes < previous.bytes * (1 - MAX_SHRINK)) {
    const percent = Math.round((1 - manifest.bytes / previous.bytes) * 100);
    found.push(`The dump is ${percent}% smaller than${since}: ${manifest.bytes} bytes, down from ${previous.bytes}.`);
  }
  found.push(...messageProblems(manifest.messages, previous?.messages, since));
  for (const [table, rule] of Object.entries(rules)) {
    const stats = manifest.tables[table];
    if (!stats) {
      found.push(`${table}: not in the backup.`);
      continue;
    }
    if (rule.minRows !== undefined && stats.rows < rule.minRows) {
      found.push(`${table}: ${stats.rows} rows, fewer than the ${rule.minRows} expected.`);
    }
    const before = previous?.tables[table];
    if (rule.neverShrinks && before && stats.rows < before.rows) {
      found.push(`${table}: ${stats.rows} rows, down from ${before.rows}${since}.`);
    }
    if (rule.newWithinHours !== undefined) {
      const newest = stats.newest ? new Date(stats.newest) : undefined;
      const hours = newest ? (Date.parse(manifest.at) - newest.getTime()) / 3_600_000 : Infinity;
      if (hours > rule.newWithinHours) {
        const when = newest ? `is from ${newest.toISOString()}` : "doesn't exist";
        found.push(
          `${table}: the newest row ${when}, but should be within ${rule.newWithinHours} hours of the backup.`,
        );
      }
    }
  }
  return found;
}
