"use client";

import { unstable_isUnrecognizedActionError } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_ATTACHMENT_BYTES } from "@/lib/mailings/attachments";
import { earliestRun, fromLondon, londonDayTime, SENDING } from "@/lib/staff-time";
import type { MailingAttachmentSummary, SaveResult } from "@/lib/mailings/drafts.server";
import { Button } from "@/components/ui/Button";
import { SaveState as SaveStatePill, type SaveStateValue as SaveState } from "@/components/ui/SaveState";
import { CHECK_EVERY, DueTimeFields, dueTime } from "./DueTime";
import { keepDraftOnReload } from "../shell/stale-actions.client";
import IconText from "../ui/IconText";
import TickIcon from "../ui/TickIcon";
import styles from "./MailingWriter.module.css";
import { mailingsCopy } from "./copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";

// What a draft mailing's page and a draft message's page share: saving as
// you type, its files, and its title with whether it's saved.

const copy = mailingsCopy.mailingPages;

/** How long after the last change a draft saves itself. */
const SAVE_DELAY = 800;

export type { SaveState };

export type AttachResult = (SaveResult | { saved: false; reason: "too-big" }) & {
  attachments: MailingAttachmentSummary[];
};

/** The Server Actions saving a draft takes, which the page hands in. */
export type DraftActions = {
  save: (id: number, version: number, changes: unknown) => Promise<SaveResult | undefined>;
  attach: (form: FormData) => Promise<AttachResult | undefined>;
  detach: (id: number, version: number, attachmentId: number) => Promise<AttachResult>;
};

/**
 * A draft's title, with whether it's saved at the top right, scrolling away
 * with the title; once the title has scrolled off, in a bar at the top of
 * the window with the title, in the same place. The window's tab has the
 * title too, changing as it's typed, as the page's own title would once
 * saved and opened again.
 */
export function DraftTitle({ title, saveState }: { title: string; saveState?: SaveState }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [titleGone, setTitleGone] = useState(false);
  useEffect(() => {
    document.title = staffVocabulary.tabTitle(title);
  }, [title]);
  useEffect(() => {
    // Gone once half of it has scrolled off.
    const watch = new IntersectionObserver(([entry]) => setTitleGone(entry.intersectionRatio < 0.5), {
      threshold: [0, 0.5, 1],
    });
    watch.observe(heading.current!);
    return () => watch.disconnect();
  }, []);
  return (
    <>
      <div className={styles.barFrame} data-shown={titleGone || undefined}>
        <div className={styles.bar}>
          <strong aria-hidden="true">{title}</strong>
          {/* None for what's not a draft yet, as nothing's saved. */}
          {saveState && (
            <span role="status">
              <SaveStatePill state={saveState}>{copy.savePill[saveState]}</SaveStatePill>
            </span>
          )}
        </div>
      </div>
      <h1 ref={heading} className={styles.title}>
        {title}
      </h1>
    </>
  );
}

/** Where a draft's changes wait across a reload, while the page is too old to save them. */
const unsavedKey = (id: number) => `draft-unsaved-${id}`;

/** What's kept across a reload: the changes, and the version they're changes to. */
type Unsaved = { version: number; changes: Record<string, unknown> };

/** A draft's changes kept for it before a reload, if they're to the version it has now; taken, so they're kept once. */
function takeUnsaved(id: number, version: number): Record<string, unknown> | null {
  try {
    const kept = sessionStorage.getItem(unsavedKey(id));
    sessionStorage.removeItem(unsavedKey(id));
    if (!kept) return null;
    const unsaved = JSON.parse(kept) as Unsaved;
    if (unsaved.version !== version) return null;
    const { dueAt } = unsaved.changes;
    return typeof dueAt === "string" ? { ...unsaved.changes, dueAt: new Date(dueAt) } : unsaved.changes;
  } catch {
    return null;
  }
}

/**
 * A draft's values and saving them: each change a moment after it's made,
 * or at once with saveNow, before leaving the page, scheduling or sending a
 * test. `fresh`, what a draft with nothing written yet starts with, is
 * saved with its first change. Someone else saving meanwhile stops the
 * saving and says so. A time too soon, or gone, when the draft is opened, or
 * that becomes so while it's open, moves on to the first hour it can go at,
 * and that's saved.
 *
 * A deploy since the page was opened leaves it calling Server Actions the
 * site no longer has, so nothing it does can work: the draft is then
 * outdated, saving stops, and changes made since its last save are kept.
 * `stale` says whether an action's error was that, and marks the draft so;
 * the page says it (SiteUpdated). Leaving an outdated page, as reloading it
 * does, keeps the changes in the tab's session storage; the page, opened
 * again, takes them back and saves them, and `restored` goes up by one, for
 * an editor that reads its words only once to be made anew.
 */
export function useDraftWriter<Changes extends { dueAt: Date | null }>({
  id,
  version: firstVersion,
  initial,
  fresh,
  attachments: firstAttachments,
  actions,
}: {
  id: number;
  version: number;
  initial: Changes;
  fresh: Partial<Changes>;
  attachments: MailingAttachmentSummary[];
  actions: DraftActions;
}) {
  const version = useRef(firstVersion);
  const [values, setValues] = useState<Changes>(() => ({ ...initial, ...fresh }));
  const latest = useRef(values);
  const [attachments, setAttachments] = useState(firstAttachments);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [fileProblem, setFileProblem] = useState("");
  const pending = useRef<Partial<Changes>>(fresh);
  const saving = useRef(false);
  /** The save under way, if any: what saveNow waits for before it saves the rest. */
  const underway = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const outdated = useRef(false);
  const [restored, setRestored] = useState(0);

  /** Whether `error` is from a Server Action this page has but the site no longer does; if so, the draft's outdated. */
  function stale(error: unknown): boolean {
    if (!unstable_isUnrecognizedActionError(error)) return false;
    outdated.current = true;
    clearTimeout(timer.current);
    setSaveState("outdated");
    return true;
  }

  // Leaving an outdated page keeps what isn't saved yet, for the page, opened again, to take back.
  useEffect(() => {
    const leaving = () => {
      if (!outdated.current) return;
      try {
        sessionStorage.setItem(
          unsavedKey(id),
          JSON.stringify({ version: version.current, changes: pending.current } satisfies Unsaved),
        );
      } catch {
        // With no session storage, the page opens again as it was last saved.
      }
    };
    window.addEventListener("pagehide", leaving);
    const unkeep = keepDraftOnReload();
    return () => {
      window.removeEventListener("pagehide", leaving);
      unkeep();
    };
  }, [id]);

  function flush(): Promise<void> {
    if (saving.current) {
      later();
      return underway.current;
    }
    underway.current = save();
    return underway.current;
  }

  async function save(): Promise<void> {
    const changes = pending.current;
    pending.current = {};
    saving.current = true;
    setSaveState("saving");
    try {
      const result = (await actions.save(id, version.current, changes))!;
      if (result.saved) {
        version.current = result.version;
        setSaveState("saved");
      } else {
        setSaveState("conflict");
      }
    } catch (error) {
      pending.current = { ...changes, ...pending.current };
      if (!stale(error)) setSaveState("failed");
    } finally {
      saving.current = false;
    }
  }

  function later() {
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  }

  function change(changes: Partial<Changes>) {
    if (saveState === "conflict") return;
    latest.current = { ...latest.current, ...changes };
    setValues(latest.current);
    pending.current = { ...pending.current, ...changes };
    // Outdated, it's kept for the reload, and not saved.
    if (outdated.current) return;
    // Saving from the change, not only once its save starts, so Saved means nothing's waiting.
    setSaveState("saving");
    later();
  }

  /** Saves what's not saved yet, after any save under way, so what follows has the latest version. */
  async function saveNow(): Promise<void> {
    clearTimeout(timer.current);
    await underway.current;
    clearTimeout(timer.current);
    if (Object.keys(pending.current).length && !outdated.current) await flush();
  }

  /** Shows what's attached after an attach or a detach; whether it was done. */
  function attached(result: AttachResult | undefined): boolean {
    if (!result) return false;
    setAttachments(result.attachments);
    if (result.saved) version.current = result.version;
    else if (result.reason === "too-big") setFileProblem(copy.tooBig);
    else setSaveState("conflict");
    return result.saved;
  }

  /**
   * Attaches each file in turn, stopping at the first that isn't. One too
   * big isn't sent, as Next.js would refuse the request before the server
   * could say why.
   */
  async function attach(files: File[]) {
    setFileProblem("");
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) return setFileProblem(copy.tooBig);
      const form = new FormData();
      clearTimeout(timer.current);
      form.set("id", String(id));
      form.set("version", String(version.current));
      form.set("file", file);
      const result = await actions.attach(form).catch(() => null);
      if (result === null) return setFileProblem(copy.attachFailed);
      if (!attached(result)) return;
    }
  }

  const detach = async (file: number) => void attached(await actions.detach(id, version.current, file));

  useEffect(() => {
    const unsaved = takeUnsaved(id, firstVersion);
    if (unsaved) {
      change(unsaved as Partial<Changes>);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- once, on load, from sessionStorage, which the server render couldn't read
      setRestored(1);
    }
    // Once, as the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const check = () => {
      const due = latest.current.dueAt;
      if (due && due < earliestRun()) change({ dueAt: earliestRun() } as Partial<Changes>);
    };
    check();
    const timer = setInterval(check, CHECK_EVERY);
    return () => clearInterval(timer);
    // The checks read what's latest, so they're set up once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    values,
    change,
    saveNow,
    saveState,
    version,
    attachments,
    attach,
    detach,
    fileProblem,
    stale,
    restored,
  };
}

/**
 * Schedule: what's still to be saved, such as a time just chosen, goes
 * first, or it's scheduled without it. Scheduled, the action brings back
 * the scheduled page (revalidatePath), which takes the writer's place, and
 * this button with it: as it goes, the window goes to the top, so the new
 * page shows from its top, as a new page would. Till then the button stays
 * pending, and the page where it was. An outdated page (useDraftWriter's
 * `stale`) can't schedule: the button's back, and the draft says why.
 */
export function ScheduleButton({
  label,
  disabled,
  saveNow,
  schedule,
  stale,
}: {
  label: string;
  disabled: boolean;
  saveNow: () => Promise<unknown>;
  schedule: () => Promise<{ scheduled: boolean }>;
  stale: (error: unknown) => boolean;
}) {
  const [scheduling, setScheduling] = useState(false);
  const trying = useRef(false);
  useLayoutEffect(
    () => () => {
      if (trying.current) window.scrollTo({ top: 0, behavior: "instant" });
    },
    [],
  );
  return (
    <Button
      variant="primary"
      fit
      disabled={disabled}
      pending={scheduling}
      onClick={async () => {
        setScheduling(true);
        await saveNow();
        trying.current = true;
        const scheduled = await schedule().then(
          (result) => result.scheduled,
          (error: unknown) => {
            if (stale(error)) return false;
            throw error;
          },
        );
        if (!scheduled) {
          trying.current = false;
          setScheduling(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

/**
 * How the last test copy went, under its button, read out as it changes:
 * sent, in green with a tick, as it's what was being waited for; or not, in
 * red. Nothing before one is sent.
 */
export function TestSent({ line, sent }: { line?: string; sent: boolean }) {
  return (
    <p role="status" className={styles.testSent}>
      {line &&
        (sent ? (
          <IconText icon={<TickIcon className={styles.testTick} />}>{line}</IconText>
        ) : (
          <span className={styles.testFailed}>{line}</span>
        ))}
    </p>
  );
}

/** Of what stops a draft being scheduled, what stops a test copy too: there's nothing yet to test. */
export const TEST_NEEDS: string[] = ["no-subject", "no-letter", "no-template"];

/**
 * What stops the button over it, as errors: a red bullet each, in the
 * order of the page's sections; nothing when nothing does.
 */
export function ProblemList({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <ul className={styles.problems}>
      {problems.map((problem) => (
        <li key={problem}>{problem}</li>
      ))}
    </ul>
  );
}

/**
 * When a draft goes: London's day, hour and minutes, a run of the sending. A
 * day chosen without an hour is kept, showing, till there's an hour too,
 * which sets `dueAt`.
 */
export function DueSection({ dueAt, onChange }: { dueAt: Date | null; onChange: (dueAt: Date) => void }) {
  const [dayPicked, setDayPicked] = useState("");
  const when = dueAt
    ? dueTime(dueAt)
    : { day: dayPicked || londonDayTime(earliestRun()).day, hour: null, minute: SENDING.minutes[0] };
  return (
    <div className={styles.when}>
      <DueTimeFields
        day={when.day}
        hour={when.hour}
        minute={when.minute}
        dayClass={styles.day}
        hourClass={styles.hour}
        onChange={(day, time) => {
          setDayPicked(day);
          if (time) onChange(fromLondon(day, time.hour, time.minute));
        }}
      />
    </div>
  );
}
