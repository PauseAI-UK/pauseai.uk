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
 * was, when it was seen and how often; then the latest happening as it was
 * thrown, and its stack trace if it came with one.
 */
export default function ErrorSeenView({ error }: { error: ErrorSeen }) {
  return (
    <>
      <Breadcrumb href={ERRORS_LIST.path}>{copy.one.back}</Breadcrumb>
      <Band title={error.words}>
        <BandFact label={copy.one.where} detail={error.route}>
          {copy.kinds[error.kind]}
        </BandFact>
        <BandFact label={copy.one.className}>{error.name}</BandFact>
        <BandFact label={copy.one.code}>{error.code}</BandFact>
        <BandFact label={copy.one.browser}>{error.browser}</BandFact>
        <BandFact label={copy.one.last}>{staffTime(error.lastSeen)}</BandFact>
        <BandFact label={copy.one.first}>{staffTime(error.firstSeen)}</BandFact>
        <BandFact label={copy.one.count}>{error.count}</BandFact>
      </Band>
      <h2>{copy.one.latest}</h2>
      <pre className={styles.thrown}>{error.latestWords}</pre>
      <h2>{copy.one.stack}</h2>
      {error.stack ? <pre className={styles.thrown}>{error.stack}</pre> : <p>{copy.one.noStack}</p>}
    </>
  );
}
