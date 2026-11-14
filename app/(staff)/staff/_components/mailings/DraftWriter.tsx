"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_ATTACHMENT_BYTES } from "@/lib/mailings/attachments";
import { earliestRun, fromLondon, londonDayTime, SENDING } from "@/lib/staff-time";
import type { MailingAttachmentSummary, SaveResult } from "@/lib/mailings/drafts.server";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SaveState as SaveStatePill, type SaveStateValue as SaveState } from "@/components/ui/SaveState";
import { CHECK_EVERY, DueTimeFields, dueTime } from "./DueTime";
import styles from "./MailingWriter.module.css";
import { mailingsCopy } from "./copy";

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
 * the window with the title, in the same place.
 */
export function DraftTitle({ title, saveState }: { title: string; saveState?: SaveState }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [titleGone, setTitleGone] = useState(false);
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

/**
 * A draft's values and saving them: each change a moment after it's made,
 * or at once with saveNow, before leaving the page, scheduling or sending a
 * test. `fresh`, what a draft with nothing written yet starts with, is
 * saved with its first change. Someone else saving meanwhile stops the
 * saving and says so. A time too soon, or gone, when the draft is opened, or
 * that becomes so while it's open, moves on to the first hour it can go at,
 * and that's saved.
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
    } catch {
      pending.current = { ...changes, ...pending.current };
      setSaveState("failed");
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
    // Saving from the change, not only once its save starts, so Saved means nothing's waiting.
    setSaveState("saving");
    later();
  }

  /** Saves what's not saved yet, after any save under way, so what follows has the latest version. */
  async function saveNow(): Promise<void> {
    clearTimeout(timer.current);
    await underway.current;
    clearTimeout(timer.current);
    if (Object.keys(pending.current).length) await flush();
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

  return { values, change, saveNow, saveState, version, attachments, attach, detach, fileProblem };
}

/**
 * Schedule: what's still to be saved, such as a time just chosen, goes
 * first, or it's scheduled without it. Scheduled, the page becomes the
 * scheduled one's, from its top, at once, as a new page would; till then
 * the button stays pending.
 */
export function ScheduleButton({
  label,
  disabled,
  saveNow,
  schedule,
}: {
  label: string;
  disabled: boolean;
  saveNow: () => Promise<unknown>;
  schedule: () => Promise<{ scheduled: boolean }>;
}) {
  const router = useRouter();
  const [scheduling, setScheduling] = useState(false);
  return (
    <Button
      variant="primary"
      fit
      disabled={disabled}
      pending={scheduling}
      onClick={async () => {
        setScheduling(true);
        await saveNow();
        if ((await schedule()).scheduled) {
          window.scrollTo({ top: 0, behavior: "instant" });
          router.refresh();
        } else {
          setScheduling(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

/** Of what stops a draft being scheduled, what stops a test copy too: there's nothing yet to test. */
export const TEST_NEEDS: string[] = ["no-subject", "no-letter", "no-template"];

/** What stops a draft being scheduled, a line each, in the order of the page's sections; nothing when nothing does. */
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
