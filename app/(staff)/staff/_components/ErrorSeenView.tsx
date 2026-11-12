import { SubmitButton } from "@/components/ui/SubmitButton";
import { staffCopy } from "@/lib/content/staff-interface";
import type { ErrorSeen } from "@/lib/server/errors-seen";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { staffTime } from "@/lib/staff-time";
import Breadcrumb from "./Breadcrumb";
import Band, { BandFact } from "./ui/Band";
import styles from "./ErrorSeenView.module.css";

const copy = staffCopy.errorsSeen;

/**
 * One error's page: its words with what varies taken out, where and what it
 * was, when it was seen and how often, which are every happening's, with
 * the button that marks it done at the top right, or once it's done, the
 * one that makes it to do again (`setDone`, given the form's `id`, and
 * `done` "yes" to mark it), and under them who marked it and when; then,
 * under one heading that says so, the
 * latest happening alone: its browser, if it came from one, its message as
 * thrown, and its stack trace if it came with one.
 */
export default function ErrorSeenView({
  error,
  setDone,
}: {
  error: ErrorSeen;
  setDone: (form: FormData) => void | Promise<void>;
}) {
  return (
    <>
      <Breadcrumb href={ERRORS_LIST.path}>{copy.one.back}</Breadcrumb>
      <Band
        title={error.words}
        corner={
          <form action={setDone}>
            <input type="hidden" name="id" value={error.id} />
            <input type="hidden" name="done" value={error.doneAt ? "" : "yes"} />
            <SubmitButton variant={error.doneAt ? "light" : "primary"} size="small">
              {error.doneAt ? copy.one.undo : copy.one.markDone}
            </SubmitButton>
          </form>
        }
      >
        <BandFact label={copy.one.kind}>{copy.kinds[error.kind]}</BandFact>
        <BandFact label={copy.one.page}>{error.route}</BandFact>
        <BandFact label={copy.one.className}>{error.name}</BandFact>
        <BandFact label={copy.one.code}>{error.code}</BandFact>
        <BandFact label={copy.one.last}>{staffTime(error.lastSeen)}</BandFact>
        <BandFact label={copy.one.first}>{staffTime(error.firstSeen)}</BandFact>
        <BandFact label={copy.one.count}>{error.count}</BandFact>
      </Band>
      {error.doneAt && <p>{copy.one.doneBy(error.doneBy!, staffTime(error.doneAt))}</p>}
      <h2>{copy.one.latest}</h2>
      {error.browser && (
        <p>
          {copy.one.browser}: {error.browser}
        </p>
      )}
      <h3>{copy.one.message}</h3>
      <pre className={styles.thrown}>{error.latestWords}</pre>
      <h3>{copy.one.stack}</h3>
      {error.stack ? <pre className={styles.thrown}>{error.stack}</pre> : <p>{copy.one.noStack}</p>}
    </>
  );
}
