import { Fragment, type ReactNode } from "react";
import { site } from "@/lib/content/site";
import { askHref, CONTROLAI_LETTER_ASK, CONTROLAI_STATEMENT_ASK } from "@/lib/asks/asks";
import { CONTROLAI_LETTER_PAGE } from "@/lib/controlai-letter";
import type { RunningJob } from "@/lib/server/import-runs.server";
import {
  type AnyImportRun,
  IMPORT_JOBS,
  jobSchedule,
  type ImportJob,
  importPath,
  nextRun,
  type PoliticianImportJob,
  NIGHTLY,
  runStatus,
  runTone,
} from "@/lib/import-runs";
import { CONTROLAI_STATEMENT_PAGE } from "@/lib/controlai-statement";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { dueIn, staffClock, staffTime } from "@/lib/staff-time";
import styles from "./ImportJob.module.css";
import ImportCard, { ImportCards } from "./ImportCard";
import ImportIcon, { type ImportSource } from "./ImportIcon";
import JobActions from "./JobActions";
import Run, { type Decide } from "./Run";
import { RunState } from "./RunBox";
import boxes from "./RunBox.module.css";
import RunList from "./RunList";
import Strip from "../ui/Strip";
import ExternalLink from "../ui/ExternalLink";
import PageHead from "../ui/PageHead";
import Band, { BandFact } from "../ui/Band";
import { politiciansCopy } from "../politicians/copy";
import { jobsCopy } from "./copy";
import { importRunsCopy } from "@/lib/import-runs-copy";

// Every import and check: the overview at /staff/scheduled-jobs, a card each,
// and each job's own page, with its button and every run it has made.

const words = jobsCopy.import;

const CIVICRM = "https://crm.pauseai.info/";

/** Where each job reads from, as its icon. */
const SOURCES: Record<ImportJob, ImportSource> = {
  "import-luma": "luma",
  "import-parliament": "parliament",
  "import-scottish-parliament": "scottish-parliament",
  "import-senedd": "senedd",
  "import-ni-assembly": "ni-assembly",
  "import-controlai": "controlai",
  "import-controlai-statement": "controlai",
  "import-civicrm": "civicrm",
  "read-gmail": "gmail",
  "send-mailings": "sending",
  "tidy-logs": "database",
};

/** Where each body documents the API its import reads. */
const API_DOCS: Record<PoliticianImportJob, string> = {
  "import-parliament": "https://data.parliament.uk/membersdataplatform/memberquery.aspx",
  "import-scottish-parliament": "https://data.parliament.scot/#/api-list/",
  "import-senedd": "https://business.senedd.wales/mgWebService.asmx",
  "import-ni-assembly": "https://data.niassembly.gov.uk/members.asmx",
};

/** A body's import's description, button and words before its first run, with its API's documentation linked. */
function politicianImport(job: PoliticianImportJob) {
  const words = politiciansCopy.politicianImports;
  return {
    intro: words.intros[job],
    href: API_DOCS[job],
    also: words.held,
    button: words.importNow[job],
    none: words.never,
  };
}

/** Each job's description, around a link to where it reads from, and its button and what to say before its first run. */
const ABOUT: Record<
  ImportJob,
  {
    intro: { before: string; link: string; after: string };
    /** Where it reads from. */
    href: string;
    /** More of the intro, each part with a link of its own, for a job that works on more than one place. */
    then?: { link: string; after: string; href: string }[];
    also?: string;
    button: string;
    none: string;
  }
> = {
  "import-luma": {
    intro: jobsCopy.luma.intro,
    href: site.social.luma,
    button: jobsCopy.luma.importNow,
    none: jobsCopy.luma.never,
  },
  "import-parliament": politicianImport("import-parliament"),
  "import-scottish-parliament": politicianImport("import-scottish-parliament"),
  "import-senedd": politicianImport("import-senedd"),
  "import-ni-assembly": politicianImport("import-ni-assembly"),
  "import-controlai": {
    intro: jobsCopy.controlAi.intro,
    href: CONTROLAI_LETTER_PAGE,
    then: [{ ...jobsCopy.controlAi.introThen, href: askHref(CONTROLAI_LETTER_ASK) }],
    button: jobsCopy.controlAi.importNow,
    none: jobsCopy.controlAi.never,
  },
  "import-controlai-statement": {
    intro: jobsCopy.controlAiStatement.intro,
    href: CONTROLAI_STATEMENT_PAGE,
    then: [{ ...jobsCopy.controlAiStatement.introThen, href: askHref(CONTROLAI_STATEMENT_ASK) }],
    button: jobsCopy.controlAiStatement.importNow,
    none: jobsCopy.controlAiStatement.never,
  },
  "import-civicrm": {
    intro: jobsCopy.civicrm.intro,
    href: CIVICRM,
    button: jobsCopy.civicrm.importNow,
    none: jobsCopy.civicrm.never,
  },
  "read-gmail": {
    intro: jobsCopy.gmailReading.intro,
    href: "/staff/me",
    button: jobsCopy.gmailReading.readNow,
    none: jobsCopy.gmailReading.never,
  },
  "send-mailings": {
    intro: jobsCopy.sending.intro,
    href: "/staff/campaigns",
    then: [
      { ...jobsCopy.sending.introThen, href: "/staff/mailings" },
      { ...jobsCopy.sending.introLast, href: "/staff/broadcasts" },
    ],
    button: jobsCopy.sending.sendNow,
    none: jobsCopy.sending.never,
  },
  "tidy-logs": {
    intro: jobsCopy.tidying.intro,
    href: "/staff/audit-log",
    then: [
      { ...jobsCopy.tidying.introThen, href: "/staff/mailings" },
      { ...jobsCopy.tidying.introLast, href: ERRORS_LIST.path },
    ],
    button: jobsCopy.tidying.tidyNow,
    none: jobsCopy.tidying.never,
  },
};

/** What the job does, with its source linked. */
function Intro({ job }: { job: ImportJob }) {
  const { intro, href, then, also } = ABOUT[job];
  return (
    <>
      {intro.before}
      <ExternalLink href={href}>{intro.link}</ExternalLink>
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

/** That a run of the job is going, and since when; or its newest run on a line (RunBox); or that it has never run. */
function NewestRun({ job, run, running }: { job: ImportJob; run: AnyImportRun | undefined; running?: RunningJob }) {
  if (running)
    return (
      <p className={boxes.line}>
        <RunState tone="blue">{jobsCopy.runs.status.running}</RunState>
        <span className={boxes.when}>{staffTime(running.startedAt)}</span>
      </p>
    );
  if (!run) return <p className={styles.never}>{ABOUT[job].none}</p>;
  return <Run run={run} variant="line" />;
}

/** How the job stands, as its page's first fact: running, or how its newest run ended; nothing before its first. */
function jobState(run: AnyImportRun | undefined, running: RunningJob | undefined): ReactNode {
  if (running) return <RunState tone="blue">{jobsCopy.runs.status.running}</RunState>;
  return run && <RunState tone={runTone(run)}>{jobsCopy.runs.status[runStatus(run)]}</RunState>;
}

/** When a job next runs after `now`, as the overview's cards end: "Runs again in 4 minutes · 11:15". */
function untilNext(job: ImportJob, now: Date): string {
  const next = nextRun(job, now);
  return words.runsAgain(dueIn(next, now), staffClock(next));
}

/** /staff/scheduled-jobs: a card per job, each a link to its page, with how its newest run ended. */
/** The overview's sections, each the jobs that run that often, in this order. */
const SCHEDULES = ["frequent", "quarter-hour", "hourly", "nightly"] as const;

/** Every job, a card each, under a heading for how often it runs: every 5 minutes, every 15, hourly, then nightly. */
export function ImportOverview({
  newest,
  running,
  now,
}: {
  /** Each job's newest run, in IMPORT_JOBS order; undefined for one that has never run. */
  newest: (AnyImportRun | undefined)[];
  /** Each job's run going now, in the same order. */
  running: (RunningJob | undefined)[];
  /** The time the page shows, which each job's next run is after. */
  now: Date;
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
                  title={importRunsCopy.jobTitles[job]}
                  href={importPath(job)}
                  icon={<ImportIcon source={SOURCES[job]} />}
                  next={untilNext(job, now)}
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
 * One job's page: its icon and name, what it does under them, and its
 * button; then in a line, how it stands, when it last ran, when it runs
 * again and how often; and every run it has made, a row each, newest first.
 */
export function ImportJobPage({
  job,
  runs,
  running,
  run,
  decide,
  now,
}: {
  job: ImportJob;
  runs: AnyImportRun[];
  /** Its run going now, which a press won't add to. */
  running?: RunningJob;
  /** The Server Action that runs the job now. */
  run: (form: FormData) => void | Promise<void>;
  /** Applies or discards a held import. */
  decide: Decide;
  /** The time the page shows, which its next run is after. */
  now: Date;
}): ReactNode {
  const next = nextRun(job, now);
  return (
    <>
      <Band
        lead={<ImportIcon source={SOURCES[job]} large />}
        title={importRunsCopy.jobTitles[job]}
        subtitle={<Intro job={job} />}
        aside={<JobActions action={run} label={ABOUT[job].button} />}
      >
        {/* One never run has neither: the list under it says so. */}
        <BandFact label={words.facts.now}>{jobState(runs[0], running)}</BandFact>
        <BandFact label={words.facts.lastRun}>{runs[0] && staffTime(runs[0].at)}</BandFact>
        <BandFact label={words.facts.nextRun}>{words.nextRunAt(dueIn(next, now), staffClock(next))}</BandFact>
        <BandFact label={words.facts.runs}>{words[jobSchedule(job)]}</BandFact>
      </Band>
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
