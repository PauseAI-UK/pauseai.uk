import { SIGNUP_KINDS, type SignupKind } from "@/lib/supporters/signup-csv";
import SignupKindIcon from "./SignupKindIcon";
import styles from "./SignupUpload.module.css";
import { supportersCopy } from "./copy";

const copy = supportersCopy.signupUpload.kind;

/** What an upload is of, paper sign-ups or a WhatsApp group: a large button each, its icon at the left. */
export default function SignupKindChoice({
  value,
  onChange,
}: {
  value: SignupKind;
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
          className={styles.kindChoice}
          onClick={() => onChange(kind)}
        >
          <SignupKindIcon kind={kind} size={32} />
          {copy[kind]}
        </button>
      ))}
    </div>
  );
}
