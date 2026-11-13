import { Fragment, type ReactNode } from "react";
import { site } from "@/lib/content/site";
import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { CONTROLAI_LETTER_PAGE } from "@/lib/controlai-letter";
import type { RunningJob } from "@/lib/server/import-runs";
import {
  type AnyImportRun,
  IMPORT_JOBS,
  jobSchedule,
  type ImportJob,
  importPath,
  NIGHTLY,
  runStatus,
  runTone,
} from "@/lib/import-runs";
import { MEMBERS_API } from "@/lib/parliament";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { staffTime } from "@/lib/staff-time";
import styles from "./ImportJob.module.css";
import ImportCard, { ImportCards } from "./ImportCard";
import ImportIcon, { type ImportSource } from "./ImportIcon";
import JobActions from "./JobActions";
import type { Decide } from "./Run";
import RunList from "./RunList";
import Tag from "@/components/ui/Tag";
import Strip from "./ui/Strip";
import ExternalLink from "./ui/ExternalLink";
import PageHead from "./ui/PageHead";

// Every import and check: the overview at /staff/scheduled-jobs, a card each,
// and each job's own page, with its button and every run it has made.

const words = staffCopy.import;

/** PauseAI's join form, where the members come from. */
const JOIN_FORM = "https://pauseai.info/join";
const CIVICRM = "https://crm.pauseai.info/";

/** Where each job reads from, as its icon. */
const SOURCES: Record<ImportJob, ImportSource> = {
  "import-luma": "luma",
  "sync-politicians": "airtable",
  "check-mps": "parliament",
  "import-controlai": "controlai",
  "import-members": "airtable",
  "import-civicrm": "civicrm",
  "read-gmail": "gmail",
  "send-mailings": "gmail",
  "tidy-logs": "database",
};

/**
 * What a job that isn't an import does, in a lozenge after its name. An
 * import has none: its description starts by saying it imports.
 */
const KINDS: Partial<Record<ImportJob, keyof typeof words.kinds>> = {
  "check-mps": "check",
  "read-gmail": "read",
  "send-mailings": "send",
  "tidy-logs": "tidy",
};

/**
 * After that, for a job that changes something outside the site, what: the
 * Luma import tags Luma's events, and reading Gmail relays mail and emails
 * staff. Sending mailings says so already.
 */
const OUTSIDE: Partial<Record<ImportJob, string>> = {
  "import-luma": words.changesLuma,
  "read-gmail": words.kinds.send,
};

/** What a job does, and what it changes outside the site, if anything, as lozenges. */
function JobTags({ job }: { job: ImportJob }) {
  const kind = KINDS[job];
  const outside = OUTSIDE[job];
  return (
    <>
      {kind && <Tag>{words.kinds[kind]}</Tag>}
      {outside && <Tag>{outside}</Tag>}
    </>
  );
}

/** Each job's description, around a link to where it reads from, and its button and what to say before its first run. */
const ABOUT: Record<
  ImportJob,
  {
    intro: { before: string; link: string; after: string };
    /** Where it reads from: a page; the politicians' table in Airtable when left out. */
    href?: string;
    /** More of the intro, each part with a link of its own, for a job that works on more than one place. */
    then?: { link: string; after: string; href: string }[];
    also?: string;
    button: string;
    none: string;
  }
> = {
  "import-luma": {
    intro: staffCopy.luma.intro,
    href: site.social.luma,
    button: staffCopy.luma.importNow,
    none: staffCopy.luma.never,
  },
  "sync-politicians": {
    intro: staffCopy.syncs.intro,
    also: staffCopy.syncs.testMps,
    button: staffCopy.syncs.syncNow,
    none: staffCopy.syncs.none,
  },
  "check-mps": {
    intro: staffCopy.check.intro,
    href: MEMBERS_API,
    button: staffCopy.check.checkNow,
    none: staffCopy.check.never,
  },
  "import-controlai": {
    intro: staffCopy.controlAi.intro,
    href: CONTROLAI_LETTER_PAGE,
    button: staffCopy.controlAi.importNow,
    none: staffCopy.controlAi.never,
  },
  "import-members": {
    intro: staffCopy.members.intro,
    href: JOIN_FORM,
    button: staffCopy.members.importNow,
    none: staffCopy.members.never,
  },
  "import-civicrm": {
    intro: staffCopy.civicrm.intro,
    href: CIVICRM,
    button: staffCopy.civicrm.importNow,
    none: staffCopy.civicrm.never,
  },
  "read-gmail": {
    intro: staffCopy.gmailReading.intro,
    href: "/staff/me",
    button: staffCopy.gmailReading.readNow,
    none: staffCopy.gmailReading.never,
  },
  "send-mailings": {
    intro: staffCopy.sending.intro,
    href: "/staff/campaigns",
    then: [
      { ...staffCopy.sending.introThen, href: "/staff/mailings" },
      { ...staffCopy.sending.introLast, href: "/staff/broadcasts" },
    ],
    button: staffCopy.sending.sendNow,
    none: staffCopy.sending.never,
  },
  "tidy-logs": {
    intro: staffCopy.tidying.intro,
    href: "/staff/audit-log",
    then: [
      { ...staffCopy.tidying.introThen, href: "/staff/mailings" },
      { ...staffCopy.tidying.introLast, href: ERRORS_LIST.path },
    ],
    button: staffCopy.tidying.tidyNow,
    none: staffCopy.tidying.never,
  },
};

/** What the job does, with its source linked. Airtable's table link is the server's, so it comes in as a prop. */
function Intro({ job, airtableTable }: { job: ImportJob; airtableTable: string }) {
  const { intro, href, then, also } = ABOUT[job];
  return (
    <>
      {intro.before}
      <ExternalLink href={href ?? airtableTable}>{intro.link}</ExternalLink>
      {intro.after}
      {then?.map((part) => (
        <Fragment key={part.href}>
          <ExternalLink href={part.href}>{part.link}</ExternalLink>
          {part.after}
        </Fragment>
      ))}
      {also && ` ${also}`}
    </>
  );
}

/** That a run of the job is going, or how its newest run ended, and when, in a strip tinted to match (ui/Strip); or that it has never run. */
function NewestRun({ job, run, running }: { job: ImportJob; run: AnyImportRun | undefined; running?: RunningJob }) {
  if (running)
    return (
      <Strip tone="blue" icon={false}>
        <span className={styles.line}>
          {staffCopy.runs.status.running}
          <span className={styles.when}>{staffTime(running.startedAt)}</span>
        </span>
      </Strip>
    );
  if (!run)
    return (
      // A job that has never run: that's how it stands, so a strip, said plainly, not as a status in bold.
      <Strip>{ABOUT[job].none}</Strip>
    );
  return (
    <Strip tone={runTone(run) ?? "plain"} icon={false}>
      <span className={styles.line}>
        {staffCopy.runs.status[runStatus(run)]}
        <span className={styles.when}>{staffTime(run.at)}</span>
      </span>
    </Strip>
  );
}

/** /staff/scheduled-jobs: a card per job, each a link to its page, with how its newest run ended. */
/** The overview's sections, each the jobs that run that often, in this order. */
const SCHEDULES = ["frequent", "quarter-hour", "hourly", "nightly"] as const;

/** Every job, a card each, under a heading for how often it runs: every 5 minutes, every 15, hourly, then nightly. */
export function ImportOverview({
  newest,
  running,
  airtableTable,
}: {
  /** Each job's newest run, in IMPORT_JOBS order; undefined for one that has never run. */
  newest: (AnyImportRun | undefined)[];
  /** Each job's run going now, in the same order. */
  running: (RunningJob | undefined)[];
  airtableTable: string;
}) {
  return (
    <>
      <PageHead intro={words.pageIntro}>{words.pageTitle}</PageHead>
      {SCHEDULES.map((schedule) => (
        <Fragment key={schedule}>
          <h2>{words[schedule]}</h2>
          <ImportCards>
            {IMPORT_JOBS.map((job, i) =>
              jobSchedule(job) === schedule ? (
                <ImportCard
                  key={job}
                  title={jobTitles[job]}
                  href={importPath(job)}
                  icon={<ImportIcon source={SOURCES[job]} />}
                  tags={<JobTags job={job} />}
                  intro={<Intro job={job} airtableTable={airtableTable} />}
                >
                  <NewestRun job={job} run={newest[i]} running={running[i]} />
                </ImportCard>
              ) : null,
            )}
          </ImportCards>
        </Fragment>
      ))}
    </>
  );
}

/**
 * One job's page: its icon, name, how often it runs and what it does as
 * lozenges; under them, what it does in words, as the page's first
 * paragraph, and under that, at the left, its button; then every run it has
 * made, newest first.
 */
export function ImportJobPage({
  job,
  runs,
  running,
  run,
  decide,
  airtableTable,
}: {
  job: ImportJob;
  runs: AnyImportRun[];
  /** Its run going now, which a press won't add to. */
  running?: RunningJob;
  /** The Server Action that runs the job now. */
  run: (form: FormData) => void | Promise<void>;
  /** Applies or discards a held politician sync. */
  decide: Decide;
  airtableTable: string;
}): ReactNode {
  return (
    <>
      <PageHead
        lead={<ImportIcon source={SOURCES[job]} />}
        tags={
          <>
            <Tag>{words[jobSchedule(job)]}</Tag>
            <JobTags job={job} />
          </>
        }
      >
        {jobTitles[job]}
      </PageHead>
      <div className={styles.about}>
        <p>
          <Intro job={job} airtableTable={airtableTable} />
        </p>
        <JobActions action={run} label={ABOUT[job].button} />
      </div>
      {running && (
        <div className={styles.running}>
          <Strip tone="blue">
            <span>
              {running.startedBy === NIGHTLY
                ? words.runningScheduled(staffTime(running.startedAt))
                : words.running(running.startedBy, staffTime(running.startedAt))}
            </span>
          </Strip>
        </div>
      )}
      <RunList runs={runs} none={ABOUT[job].none} decide={decide} running={running} />
    </>
  );
}
