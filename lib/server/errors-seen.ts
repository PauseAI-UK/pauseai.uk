import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { Instrumentation } from "next";
import { after } from "next/server";
import { staffCopy } from "@/lib/content/staff-interface";
import type { BrowserErrorBody } from "@/lib/browser-errors";
import { type ErrorKind, isBrowserKind, steadyPath, steadyWords } from "@/lib/error-key";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { browserVersionOf } from "@/lib/user-agent";
import { config } from "./config";
import { query } from "./db";
import { notifyStaff, staffLink } from "./notifications";
import { describeError, problem } from "./problems";

// What goes wrong on the site outside a job's run, kept so that it reaches
// someone: an error the server throws in a page, a route handler, a Server
// Action or the proxy (instrumentation.ts); a problem reported outside a run
// (problem(), lib/server/problems.ts); and an error in a visitor's browser
// (/api/browser-error). Each is a row of errors_seen, counted each time it
// happens, two happenings being one error when their key matches
// (lib/error-key.ts). Staff are emailed about a new one, and at most once a
// day while it goes on happening; admins see them all at /staff/errors, and
// the nightly tidying deletes one not seen for a month. A job's failures are
// its run's (lib/server/import-runs.ts), not these.

/** How many emails about errors go in an hour, the browser's counted apart; one more then says there are many. */
export const SERVER_EMAILS_AN_HOUR = 5;
export const BROWSER_EMAILS_AN_HOUR = 3;
/** How many new errors from browsers are kept in an hour, as anyone can post one. */
export const NEW_BROWSER_ERRORS_AN_HOUR = 20;

/** How much of each part is kept. */
const NAME_KEPT = 100;
const CODE_KEPT = 100;
const LATEST_WORDS_KEPT = 2000;
const STACK_KEPT = 8000;

/** One happening, as it's kept: what makes its key, and what the row shows of the newest. */
type Happening = {
  kind: ErrorKind;
  route: string;
  name: string;
  code: string | null;
  /** Its words with what varies taken out. */
  words: string;
  /** Whether its code alone says which error it is, so its words stay out of the key. */
  byCode: boolean;
  latestWords: string;
  stack: string | null;
  browser: string | null;
};

/** A row of the list. */
export type ErrorSeen = {
  id: number;
  kind: ErrorKind;
  route: string;
  name: string;
  code: string | null;
  words: string;
  latestWords: string;
  stack: string | null;
  browser: string | null;
  firstSeen: Date;
  lastSeen: Date;
  count: number;
};

const COLUMNS = `id::int AS id, kind, route, name, code, words, latest_words AS "latestWords", latest_stack AS stack,
  latest_browser AS browser, first_seen AS "firstSeen", last_seen AS "lastSeen", count`;

/** Set while an error is being kept, so that a problem reported along the way isn't kept in turn. */
const keeping = new AsyncLocalStorage<true>();

/** The key two happenings of one error share. */
function keyOf({ kind, route, name, code, words, byCode }: Happening): string {
  return createHash("sha256")
    .update(JSON.stringify([kind, route, name, code, byCode ? "" : words]))
    .digest("hex");
}

/** A property of something thrown, if it's text. */
function textOf(thrown: unknown, property: string): string | undefined {
  const value =
    typeof thrown === "object" && thrown !== null ? (thrown as Record<string, unknown>)[property] : undefined;
  return typeof value === "string" && value ? value : undefined;
}

/**
 * What was thrown, as the parts of a happening. A Postgres error is known by
 * its code and constraint alone, as its message can quote the value it
 * refused; any other by its words, causes included, and its code if it has
 * one (ECONNREFUSED).
 */
function thrownParts(thrown: unknown): Pick<Happening, "name" | "code" | "words" | "byCode" | "latestWords" | "stack"> {
  const code = textOf(thrown, "code");
  const postgres = code !== undefined && /^[0-9A-Z]{5}$/.test(code) && textOf(thrown, "severity") !== undefined;
  const constraint = postgres ? textOf(thrown, "constraint") : undefined;
  const latestWords = describeError(thrown);
  return {
    name: (thrown instanceof Error ? thrown.name : typeof thrown).slice(0, NAME_KEPT),
    code: code === undefined ? null : [code, constraint].filter(Boolean).join(" ").slice(0, CODE_KEPT),
    words: steadyWords(latestWords),
    byCode: postgres,
    latestWords: latestWords.slice(0, LATEST_WORDS_KEPT),
    stack: textOf(thrown, "stack")?.slice(0, STACK_KEPT) ?? null,
  };
}

const VALUES = `($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
const AGAIN = `ON CONFLICT (key) DO UPDATE SET count = errors_seen.count + 1, last_seen = now(), words = EXCLUDED.words,
  latest_words = EXCLUDED.latest_words, latest_stack = EXCLUDED.latest_stack, latest_browser = EXCLUDED.latest_browser
  RETURNING id::int AS id`;

/**
 * Adds the happening's row, or counts it on the row it has. Returns the row's
 * ID, or undefined for a browser's new error past the hour's limit, which
 * isn't kept.
 */
async function count(happening: Happening): Promise<number | undefined> {
  const { kind, route, name, code, words, latestWords, stack, browser } = happening;
  const values = [keyOf(happening), kind, route, name, code, words, latestWords, stack, browser];
  const columns = "key, kind, route, name, code, words, latest_words, latest_stack, latest_browser";
  if (!isBrowserKind(kind)) {
    const [row] = await query<{ id: number }>(`INSERT INTO errors_seen (${columns}) VALUES ${VALUES} ${AGAIN}`, values);
    return row.id;
  }
  // A new row only while the hour has room; a row it already has is counted whatever the hour holds.
  const [row] = await query<{ id: number }>(
    `INSERT INTO errors_seen (${columns})
     SELECT * FROM (VALUES ${VALUES}) AS happening
     WHERE EXISTS (SELECT 1 FROM errors_seen WHERE key = $1)
       OR (SELECT count(*) FROM errors_seen
           WHERE kind IN ('browser-page', 'browser-other') AND first_seen > now() - interval '1 hour') < $10
     ${AGAIN}`,
    [...values, NEW_BROWSER_ERRORS_AN_HOUR],
  );
  return row?.id;
}

/**
 * The words of the browser's other errors that have earned an email. The
 * rest only show on the staff page, as much of what a browser throws isn't
 * ours: extensions, in-app browsers, other sites' scripts.
 */
const BROWSER_WORDS_EMAILED: readonly string[] = [];

/** Whether staff are emailed about this error at all. */
function emailed({ kind, words }: Happening): boolean {
  return kind !== "browser-other" || BROWSER_WORDS_EMAILED.includes(words);
}

/**
 * Emails the notification inbox about the row, if it's new or a day has
 * passed since it was last due an email, and the hour's emails haven't run
 * out. The row is taken before anything is sent, so two requests failing at
 * once send one email. A browser's error is described by its page alone, as
 * its words are whatever was posted.
 */
async function tell(id: number, happening: Happening): Promise<void> {
  if (!emailed(happening) || !config.notificationInbox) return;
  const [taken] = await query<{ first: boolean; since: number; count: number; hour: number }>(
    `WITH was AS (SELECT alerted_at, alerted_count FROM errors_seen WHERE id = $1 FOR UPDATE),
       took AS (
         UPDATE errors_seen e SET alerted_at = now(), alerted_count = e.count FROM was
         WHERE e.id = $1 AND (was.alerted_at IS NULL OR was.alerted_at <= now() - interval '1 day')
         RETURNING was.alerted_at IS NULL AS first, e.count - was.alerted_count AS since, e.count)
     SELECT took.first, took.since, took.count,
       (SELECT count(*)::int FROM errors_seen o
        WHERE o.id <> $1 AND o.alerted_at > now() - interval '1 hour'
          AND (o.kind IN ('browser-page', 'browser-other')) = $2) AS hour
     FROM took`,
    [id, isBrowserKind(happening.kind)],
  );
  if (!taken) return;
  const browser = isBrowserKind(happening.kind);
  const limit = browser ? BROWSER_EMAILS_AN_HOUR : SERVER_EMAILS_AN_HOUR;
  if (taken.hour > limit) return;
  const copy = staffCopy.errorsSeen.email;
  if (taken.hour === limit) {
    const many = browser ? copy.manyBrowser : copy.many;
    await notifyStaff(many.subject, many.body(staffLink(ERRORS_LIST.path, undefined)));
    return;
  }
  const where = [staffCopy.errorsSeen.kinds[happening.kind], happening.route].filter(Boolean).join(" ");
  const link = staffLink(`${ERRORS_LIST.path}/${id}`, undefined);
  const { first, since, count: total } = taken;
  const { words } = happening;
  if (browser) {
    const body = first ? copy.browser.first(where, link) : copy.browser.again(where, since, total, link);
    await notifyStaff(copy.browser.subject(where), body);
  } else {
    const body = first ? copy.server.first(where, words, link) : copy.server.again(where, words, since, total, link);
    await notifyStaff(copy.server.subject(words), body);
  }
}

/**
 * Keeps a happening and tells staff, never throwing: what goes wrong on the
 * way is logged, and not kept in turn. Nothing is kept in development, where
 * the error is on the screen.
 */
async function keep(happening: Happening): Promise<void> {
  if (config.nodeEnv === "development") return;
  await keeping.run(true, async () => {
    try {
      const id = await count(happening);
      if (id !== undefined) await tell(id, happening);
    } catch (error) {
      problem(staffCopy.problems.logs.errorNotKept, error);
    }
  });
}

/** Keeps an error the server threw: Next's onRequestError (instrumentation.ts). */
export const keepRequestError: Instrumentation.onRequestError = async (thrown, _request, context) => {
  await keep({ kind: context.routeType, route: context.routePath, ...thrownParts(thrown), browser: null });
};

/**
 * Keeps a problem reported outside a run, by its sentence, with the error's
 * words if it came with one. Started at once, and where there's a request,
 * the platform waits for it after the response has gone.
 */
export function keepProblem(what: string, described: string | undefined): void {
  if (keeping.getStore()) return;
  const kept = keep({
    kind: "problem",
    route: "",
    name: "",
    code: null,
    words: steadyWords(what),
    byCode: false,
    latestWords: [what, described].filter(Boolean).join(": ").slice(0, LATEST_WORDS_KEPT),
    stack: null,
    browser: null,
  });
  heldOpen(kept);
}

/** Has the platform wait for work already started, where there's a request to hold open. */
function heldOpen(work: Promise<void>): void {
  try {
    after(() => work);
  } catch {
    // Outside a request, as in a script: nothing to hold open, and the work goes on regardless.
  }
}

/**
 * What a browser posted (/api/browser-error) as an error, if it's shaped as
 * one: one of the browser's kinds, text in every field, some words, and a
 * path of the site's. Each field is still whatever was sent.
 */
export function browserReport(posted: unknown): BrowserErrorBody | undefined {
  const { kind, name, words, stack, path } = (typeof posted === "object" && posted !== null ? posted : {}) as Record<
    string,
    unknown
  >;
  if (!isBrowserKind(kind)) return undefined;
  if (typeof name !== "string" || typeof words !== "string" || typeof stack !== "string") return undefined;
  if (typeof path !== "string" || !path.startsWith("/") || !words) return undefined;
  return { kind, name, words, stack, path };
}

/** Keeps an error from a visitor's browser, with the browser's name and version from its User-Agent. */
export async function keepBrowserError(report: BrowserErrorBody, userAgent: string | null): Promise<void> {
  await keep({
    kind: report.kind,
    route: steadyPath(report.path),
    name: report.name.slice(0, NAME_KEPT),
    code: null,
    words: steadyWords(report.words),
    byCode: false,
    latestWords: report.words.slice(0, LATEST_WORDS_KEPT),
    stack: report.stack.slice(0, STACK_KEPT) || null,
    browser: browserVersionOf(userAgent) ?? null,
  });
}

const PAGE_SIZE = 100;

/** The errors, the one seen most recently first, a page at a time. */
export async function listErrorsSeen(page: number): Promise<{
  errors: ErrorSeen[];
  total: number;
  pages: number;
  page: number;
  pageSize: number;
}> {
  const [{ total }] = await query<{ total: number }>("SELECT count(*)::int AS total FROM errors_seen");
  const errors = await query<ErrorSeen>(
    `SELECT ${COLUMNS} FROM errors_seen ORDER BY last_seen DESC, id DESC LIMIT $1 OFFSET $2`,
    [PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  return { errors, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), page, pageSize: PAGE_SIZE };
}

/** One error, by the ID in its page's URL, or undefined if there's none. */
export async function errorSeen(id: string): Promise<ErrorSeen | undefined> {
  if (!/^\d{1,15}$/.test(id)) return undefined;
  const [row] = await query<ErrorSeen>(`SELECT ${COLUMNS} FROM errors_seen WHERE id = $1`, [id]);
  return row;
}

/** Deletes the errors not seen for a month. Returns how many went. */
export async function tidyErrorsSeen(): Promise<number> {
  const gone = await query("DELETE FROM errors_seen WHERE last_seen < now() - interval '1 month' RETURNING 1");
  return gone.length;
}
