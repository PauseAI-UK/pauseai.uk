"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Button, ButtonAnchor } from "@/components/ui/Button";
import Table from "@/components/ui/Table";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { SignupUploadFinished, SignupUploadRefused } from "@/lib/server/signup-uploads";
import {
  SIGNUP_PILES,
  SIGNUP_UPLOAD_STORAGE,
  signupHeldCsv,
  signupPileCounts,
  type SignupPile,
  type SignupPlan,
  type SignupPlanRow,
  type SignupUploadInput,
} from "@/lib/signup-upload";
import StaffLink from "./ui/StaffLink";
import Strip from "./ui/Strip";
import styles from "./SignupUpload.module.css";

const copy = staffCopy.signupUpload;
const words = copy.preview;
const FORM_PATH = "/staff/supporters/upload";

/** Why a person is held back, in words. */
function whyHeld(row: SignupPlanRow): string {
  if (!row.problem) return "";
  return row.problem.kind === "unread-yes-no"
    ? words.unread(row.problem.value, row.problem.column)
    : words.problems[row.problem.kind];
}

const LUMA_TONES = { held: "red", register: "green", going: undefined, none: undefined, done: undefined } as const;

/** The piles and every person, shown as one long table, or one pile's people. */
export function SignupPlanView({
  plan,
  pending = false,
  onImport,
}: {
  plan: SignupPlan;
  pending?: boolean;
  onImport: () => void;
}) {
  const [pile, setPile] = useState<SignupPile | "all">("all");
  const counts = signupPileCounts(plan);
  const fresh = plan.rows.filter((row) => row.newEntry);
  const shown = [...plan.rows]
    .filter((row) => pile === "all" || row.pile === pile)
    .sort((a, b) => SIGNUP_PILES.indexOf(a.pile) - SIGNUP_PILES.indexOf(b.pile));
  const summary = words.summary;
  const note = plan.input.note.trim();
  const heldCsv = counts.held > 0 && signupHeldCsv(plan, { why: words.why }, whyHeld);
  const permission = fresh.filter((row) => row.mailingList).length;
  const known = fresh.filter((row) => row.known).length;
  const offered = SIGNUP_PILES.filter((key) => counts[key] > 0);
  // What a person who gets no entry, held back or already imported, would have had says nothing.
  const entryAnswer = (row: SignupPlanRow, yes: boolean) => (row.newEntry ? (yes ? words.yes : words.no) : "–");

  return (
    <div className={styles.page}>
      <ul className={styles.summary}>
        <li>
          {summary.entries(fresh.length)} {summary.supporters(fresh.length - known, known)}
        </li>
        <li>{summary.permission(permission)}</li>
        <li>{plan.eventName ? summary.event(plan.eventName, counts.register) : summary.noEvent}</li>
        {note && <li>{summary.note(note)}</li>}
        {plan.ignored.length > 0 && <li>{summary.ignored(plan.ignored.join(", "))}</li>}
      </ul>

      <div className={styles.piles} role="group" aria-label={words.title}>
        {(["all", ...offered] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={styles.pile}
            aria-pressed={pile === key}
            onClick={() => setPile(key)}
          >
            <strong>{key === "all" ? plan.rows.length : counts[key]}</strong>
            <span>{words.piles[key]}</span>
          </button>
        ))}
      </div>
      <p>{words.explain[pile]}</p>
      {heldCsv && (pile === "held" || pile === "all") && (
        <div>
          <ButtonAnchor
            variant="ghost"
            size="small"
            fit
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(heldCsv)}`}
            download={words.downloadName(plan.input.filename)}
          >
            {words.download}
          </ButtonAnchor>
        </div>
      )}

      <Table>
        <thead>
          <tr>
            <th>{words.table.row}</th>
            <th>{words.table.person}</th>
            <th>{words.table.phone}</th>
            <th>{words.table.postcode}</th>
            <th>{words.table.supporter}</th>
            <th>{words.table.entry}</th>
            <th>{words.table.luma}</th>
            <th>{words.table.permission}</th>
            {counts.held > 0 && <th>{words.table.why}</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.line}>
              <td>{row.line}</td>
              <td>
                {row.name}
                <br />
                {row.email}
              </td>
              <td className={styles.nowrap}>{row.phone}</td>
              <td>{row.postcode}</td>
              <td>
                {row.pile !== "held" && (
                  <Tag tone={row.known ? "blue" : "green"}>
                    {row.known ? words.known[row.known] : words.known.fresh}
                  </Tag>
                )}
              </td>
              <td>{entryAnswer(row, true)}</td>
              <td>
                <Tag tone={LUMA_TONES[row.pile]}>{words.piles[row.pile]}</Tag>
              </td>
              <td>{entryAnswer(row, row.mailingList)}</td>
              {counts.held > 0 && <td>{whyHeld(row)}</td>}
            </tr>
          ))}
        </tbody>
      </Table>

      <div className={styles.actions}>
        {fresh.length + counts.register > 0 ? (
          <Button variant="primary" fit pending={pending} onClick={onImport}>
            {plan.eventName ? words.importNow(fresh.length, counts.register) : words.importOnly(fresh.length)}
          </Button>
        ) : (
          <p>{words.nothing}</p>
        )}
        <StaffLink href={FORM_PATH}>{words.backToForm}</StaffLink>
      </div>
    </div>
  );
}

/** Nothing stored in this tab's lifetime changes it from elsewhere, so there's nothing to listen for. */
const noChanges = () => () => {};

type Outcome = SignupPlan | SignupUploadRefused | "failed";

/**
 * The preview of an upload: the file the form left in this tab, as the server
 * says it would go in, and importing it. If what's held has moved on by then,
 * it shows what would happen now instead, for another look.
 */
export default function SignupUploadPreview({
  preview,
  finish,
}: {
  preview: (input: SignupUploadInput) => Promise<SignupPlan | SignupUploadRefused>;
  finish: (input: SignupUploadInput, signature: string) => Promise<SignupUploadFinished>;
}) {
  const router = useRouter();
  const stored = useSyncExternalStore(
    noChanges,
    () => sessionStorage.getItem(SIGNUP_UPLOAD_STORAGE),
    () => undefined,
  );
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [changed, setChanged] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!stored) return;
    let gone = false;
    preview(JSON.parse(stored) as SignupUploadInput).then(
      (result) => !gone && setOutcome(result),
      () => !gone && setOutcome("failed"),
    );
    return () => {
      gone = true;
    };
  }, [stored, preview]);

  if (stored === null) {
    return (
      <p>
        {words.none} <StaffLink href={FORM_PATH}>{words.start}</StaffLink>
      </p>
    );
  }
  if (outcome === null) return <p>{words.loading}</p>;
  if (outcome === "failed") return <Strip tone="red">{words.failed}</Strip>;
  if ("ok" in outcome) {
    return (
      <Strip tone="red" action={<StaffLink href={FORM_PATH}>{words.backToForm}</StaffLink>}>
        {copy.refused.badChoice}
      </Strip>
    );
  }
  const plan = outcome;

  function importNow() {
    start(async () => {
      try {
        const finished = await finish(plan.input, plan.signature);
        if ("uploadId" in finished) {
          router.push(`${FORM_PATH}/${finished.uploadId}`);
          sessionStorage.removeItem(SIGNUP_UPLOAD_STORAGE);
        } else if ("changed" in finished) {
          setChanged(true);
          setOutcome(finished.changed);
        } else {
          setOutcome(finished);
        }
      } catch {
        setOutcome("failed");
      }
    });
  }

  return (
    <div className={styles.page}>
      {changed && <Strip tone="amber">{words.changed}</Strip>}
      <SignupPlanView plan={plan} pending={pending} onImport={importNow} />
    </div>
  );
}
