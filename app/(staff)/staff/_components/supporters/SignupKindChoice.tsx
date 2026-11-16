import { SIGNUP_KINDS, type SignupKind } from "@/lib/supporters/signup-csv";
import SignupKindIcon from "./SignupKindIcon";
import styles from "./SignupUpload.module.css";
import { supportersCopy } from "./copy";

const copy = supportersCopy.signupUpload.kind;

/**
 * What an upload is of, paper sign-ups or a WhatsApp group: a large button
 * each: its icon at the left, and beside it its name and, under that, what the file is.
 * `value` is null until one is picked. Each button is named by its name
 * alone, what the file is its description; there's one choice on a page, so
 * the ids are fixed.
 */
export default function SignupKindChoice({
  value,
  onChange,
}: {
  value: SignupKind | null;
  onChange: (kind: SignupKind) => void;
}) {
  return (
    <div className={styles.kinds} role="radiogroup" aria-label={copy.label}>
      {SIGNUP_KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          role="radio"
          aria-checked={kind === value}
          aria-labelledby={`signup-kind-${kind}`}
          aria-describedby={`signup-kind-${kind}-about`}
          className={styles.kindChoice}
          onClick={() => onChange(kind)}
        >
          <SignupKindIcon kind={kind} size={40} />
          <span className={styles.kindName} id={`signup-kind-${kind}`}>
            {copy[kind]}
          </span>
          <span className={styles.kindAbout} id={`signup-kind-${kind}-about`}>
            {copy.about[kind]}
          </span>
        </button>
      ))}
    </div>
  );
}
