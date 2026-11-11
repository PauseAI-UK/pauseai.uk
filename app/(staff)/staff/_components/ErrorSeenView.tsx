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
 * was, when it was seen and how often, which are every happening's; then,
 * under one heading that says so, the latest happening alone: its browser,
 * if it came from one, its message as thrown, and its stack trace if it
 * came with one.
 */
export default function ErrorSeenView({ error }: { error: ErrorSeen }) {
  return (
    <>
      <Breadcrumb href={ERRORS_LIST.path}>{copy.one.back}</Breadcrumb>
      <Band title={error.words}>
        <BandFact label={copy.one.kind}>{copy.kinds[error.kind]}</BandFact>
        <BandFact label={copy.one.page}>{error.route}</BandFact>
        <BandFact label={copy.one.className}>{error.name}</BandFact>
        <BandFact label={copy.one.code}>{error.code}</BandFact>
        <BandFact label={copy.one.last}>{staffTime(error.lastSeen)}</BandFact>
        <BandFact label={copy.one.first}>{staffTime(error.firstSeen)}</BandFact>
        <BandFact label={copy.one.count}>{error.count}</BandFact>
      </Band>
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
