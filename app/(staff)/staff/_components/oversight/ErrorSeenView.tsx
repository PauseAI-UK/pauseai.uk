import { SubmitButton } from "@/components/ui/SubmitButton";
import type { ErrorSeen } from "@/lib/oversight/errors-seen.server";
import { staffTime } from "@/lib/staff-time";
import Band, { BandFact } from "../ui/Band";
import Empty from "../ui/Empty";
import Grid, { Card } from "../ui/Grid";
import styles from "./ErrorSeenView.module.css";
import { oversightCopy } from "@/lib/oversight/copy";

const copy = oversightCopy.errorsSeen;

/**
 * One error's page: its words with what varies taken out, where and what it
 * was, when it was seen and how often, which are every happening's, with
 * the button that marks it done at the top right, or once it's done, the
 * one that makes it to do again (`setDone`, given the form's `id`, and
 * `done` "yes" to mark it), and under them who marked it and when; then,
 * under one heading that says so, the
 * latest happening alone, in two cards: its message as thrown, with its
 * browser, if it came from one; and its stack trace, or that it came with
 * none.
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
      <Band
        title={error.words}
        corner={
          <form action={setDone}>
            <input type="hidden" name="id" value={error.id} />
            <input type="hidden" name="done" value={error.doneAt ? "" : "yes"} />
            <SubmitButton variant={error.doneAt ? "ghost" : "primary"} size="small">
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
      {error.doneAt && <p className={styles.done}>{copy.one.doneBy(error.doneBy!, staffTime(error.doneAt))}</p>}
      <h2>{copy.one.latest}</h2>
      <Grid>
        <Card span={6} title={copy.one.message} id="error-message">
          {error.browser && (
            <p className={styles.browser}>
              {copy.one.browser}: {error.browser}
            </p>
          )}
          <pre className={styles.thrown}>{error.latestWords}</pre>
        </Card>
        <Card span={6} look="log" title={copy.one.stack} id="error-stack">
          {error.stack ? <pre className={styles.thrown}>{error.stack}</pre> : <Empty>{copy.one.noStack}</Empty>}
        </Card>
      </Grid>
    </>
  );
}
