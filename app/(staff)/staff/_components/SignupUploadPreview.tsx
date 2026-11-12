"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { SignupUploadFinished, SignupUploadRefused } from "@/lib/server/signup-uploads";
import {
  SIGNUP_PILES,
  signupPileCounts,
  signupUploadPath,
  type SignupPlan,
  type SignupPlanRow,
  type SignupRowProblem,
  type SignupUploadInput,
} from "@/lib/signup-upload";
import { Card } from "./ui/Grid";
import Numbered from "./ui/Numbered";
import Strip from "./ui/Strip";
import styles from "./SignupUpload.module.css";
import { phoneWords } from "@/lib/phone";
import { emailSettingsCopy, settingsDate } from "@/lib/content/email-settings";
import { LINK_DAYS } from "@/lib/email-settings";

const copy = staffCopy.signupUpload;
const words = copy.preview;
/** The columns' names, as what the file needs calls them. */
const fields = copy.help.fields;

/** Why a person is held back, in words. */
function whyHeld(problem: SignupRowProblem): string {
  return problem.kind === "unread-yes-no" ? words.unread(problem.value, problem.column) : words.problems[problem.kind];
}

/** What will happen to one person, a lozenge each: held back and why; or already imported; or the supporter they'll be, Luma, and how they can be contacted. */
function Happens({ row }: { row: SignupPlanRow }) {
  const said = words.happens;
  if (row.pile === "held") {
    return (
      <span className={styles.lozenges}>
        <Tag tone="red">{said.notImported}</Tag>
        <Tag tone="amber">{whyHeld(row.problem!)}</Tag>
      </span>
    );
  }
  return (
    <span className={styles.lozenges}>
      {!row.newEntry && <Tag>{said.alreadyImported}</Tag>}
      {row.newEntry && row.known && <Tag tone="blue">{said.known[row.known]}</Tag>}
      {row.pile === "register" && <Tag tone="green">{said.register}</Tag>}
      {row.pile === "going" && <Tag>{said.going}</Tag>}
      {row.newEntry && <Tag tone="green">{said.mailing}</Tag>}
      {row.newEntry && row.phone && <Tag tone="green">{said.phone}</Tag>}
      {row.notice === "bulk" && <Tag tone="amber">{said.notice}</Tag>}
      {row.notice === "no-email" && <Tag tone="red">{said.noEmail}</Tag>}
    </span>
  );
}

/**
 * The email anyone with "No bulk emails" gets, as they'll see it: where and
 * when the forms say they signed up, which change as they're typed, and a
 * stand-in for their own link.
 */
function BulkNoticeView({ input }: { input: Pick<SignupUploadInput, "note" | "signedOn"> }) {
  const notice = emailSettingsCopy.bulkNotice;
  const where = notice.paper(input.note.trim(), settingsDate(new Date(`${input.signedOn}T12:00:00Z`)));
  return (
    <blockquote className={styles.notice}>
      <strong>{notice.subject}</strong>
      <span className={styles.noticeBody}>{notice.body(where, words.summary.theirLink, LINK_DAYS)}</span>
    </blockquote>
  );
}

/** The people, each with what will happen to them, those held back first, as they're what needs doing. */
export function SignupPlanView({ plan }: { plan: SignupPlan }) {
  const counts = signupPileCounts(plan);
  const fresh = plan.rows.filter((row) => row.newEntry);
  const shown = [...plan.rows].sort((a, b) => SIGNUP_PILES.indexOf(a.pile) - SIGNUP_PILES.indexOf(b.pile));
  const summary = words.summary;
  const known = fresh.filter((row) => row.known).length;
  const notices = plan.rows.filter((row) => row.notice === "bulk").length;
  const noEmail = plan.rows.filter((row) => row.notice === "no-email").length;

  return (
    <div className={styles.page}>
      <ul className={styles.summary}>
        <li>
          {summary.entries(fresh.length)} {summary.supporters(fresh.length - known, known)}
        </li>
        {counts.held > 0 && <li>{summary.held(counts.held)}</li>}
        {plan.eventName && <li>{summary.event(plan.eventName, counts.register)}</li>}
        {noEmail > 0 && <li>{summary.noEmail(noEmail)}</li>}
        {notices > 0 && <li>{summary.notices(notices)}</li>}
      </ul>
      {notices > 0 && <BulkNoticeView input={plan.input} />}

      <Table>
        <thead>
          <tr>
            <th>{words.table.row}</th>
            <th>{fields.name.label}</th>
            <th>{fields.email.label}</th>
            <th>{fields.phone.label}</th>
            <th>{fields.postcode.label}</th>
            <th className={styles.happens}>{words.table.happens}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.line}>
              <td>{row.line}</td>
              <td>{row.name}</td>
              <td className={styles.email}>{row.email}</td>
              <td className={styles.nowrap}>{row.phone && phoneWords(row.phone)}</td>
              <td className={styles.nowrap}>{row.postcode}</td>
              <td>
                <Happens row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/** How long to wait after the last change, such as a key typed in the note, before working out the preview again. */
const PREVIEW_DELAY_MS = 400;

/** The upload's Server Actions (app/(staff)/staff/signup-upload-actions.ts), which the page hands in. */
export type SignupUploadActions = {
  preview: (input: SignupUploadInput) => Promise<SignupPlan | SignupUploadRefused>;
  finish: (input: SignupUploadInput, signature: string) => Promise<SignupUploadFinished>;
};

type Outcome = SignupPlan | SignupUploadRefused | "failed";

/** That the preview is being worked out: a spinner, and the words in italics. */
function Working({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.working} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      {children}
    </p>
  );
}

/** How often an import's page asks again whether Luma's been read. */
const READ_AGAIN_MS = 5000;

/**
 * On an import's page, while the Luma import it started is still to read its
 * event's guests: a spinner, and the page asked for again every few seconds,
 * which leaves this out once they're read.
 */
export function LumaReading() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), READ_AGAIN_MS);
    return () => clearInterval(timer);
  }, [router]);
  return <Working>{copy.result.lumaReading}</Working>;
}

/**
 * The last step of an upload: what importing `input` will do, as the server
 * works it out a moment after it last changed, and the button to import it,
 * greyed with what stops it listed under it. Until a
 * change is worked out, the last preview stays, and can't be imported. If what's
 * held has moved on by the time it's imported, it shows what would happen now
 * instead, for another look.
 */
export default function SignupUploadPreview({
  input,
  blockers,
  preview,
  finish,
}: SignupUploadActions & { input: SignupUploadInput | null; blockers: string[] }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<{ of: SignupUploadInput; is: Outcome } | null>(null);
  // The input that changed on the server before it went in: the notice stays
  // until something else is chosen, however often the preview runs again
  // (as it does when the page is refreshed after the import).
  const [changedFor, setChangedFor] = useState<SignupUploadInput | null>(null);
  const changed = changedFor !== null && changedFor === input;
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!input) return;
    let gone = false;
    const timer = setTimeout(() => {
      preview(input).then(
        (result) => {
          if (gone) return;
          setOutcome({ of: input, is: result });
        },
        () => !gone && setOutcome({ of: input, is: "failed" }),
      );
    }, PREVIEW_DELAY_MS);
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, [input, preview]);

  const stale = outcome?.of !== input;
  const plan = input && outcome && typeof outcome.is === "object" && !("ok" in outcome.is) ? outcome.is : null;
  const fresh = plan ? plan.rows.filter((row) => row.newEntry).length : 0;
  const registering = plan ? signupPileCounts(plan).register : 0;

  function importNow() {
    start(async () => {
      try {
        const finished = await finish(plan!.input, plan!.signature);
        if ("uploadId" in finished) router.push(signupUploadPath(finished.uploadId));
        else if ("changed" in finished) {
          setChangedFor(input);
          setOutcome({ of: input!, is: finished.changed });
        } else setOutcome({ of: input!, is: finished });
      } catch {
        setOutcome({ of: input!, is: "failed" });
      }
    });
  }

  // What's in step 3: why there's nothing yet, what went wrong, or the plan, the last one while a change is worked out.
  const shown = !input ? (
    <p>{words.needsFile}</p>
  ) : !outcome ? (
    <Working>{words.loading}</Working>
  ) : outcome.is === "failed" ? (
    <Strip tone="red">{words.failed}</Strip>
  ) : "ok" in outcome.is ? (
    <Strip tone="red">{copy.refused.badChoice}</Strip>
  ) : (
    <div className={styles.page}>
      {changed && <Strip tone="amber">{words.changed}</Strip>}
      {stale && <Working>{words.loading}</Working>}
      <SignupPlanView plan={outcome.is} />
    </div>
  );

  return (
    <Card span={6} title={<Numbered n={4}>{copy.steps.check}</Numbered>} id="upload-check">
      {shown}
      <div className={styles.actions}>
        {plan && fresh + registering === 0 ? (
          <p>{words.nothing}</p>
        ) : (
          <Button
            variant="primary"
            fit
            pending={pending}
            disabled={!plan || stale || blockers.length > 0}
            onClick={importNow}
          >
            {plan?.eventName ? words.importNow(fresh, registering) : words.importOnly(fresh)}
          </Button>
        )}
      </div>
      {blockers.length > 0 && (
        <ul className={styles.blockers}>
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
