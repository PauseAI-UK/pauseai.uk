import LinkButton from "@/components/ui/LinkButton";
import Required from "@/components/ui/Required";
import Table from "@/components/ui/Table";
import {
  KIND_FIELDS,
  REQUIRED,
  SIGNUP_FIELD_NAMES,
  SIGNUP_YES,
  type SignupField,
  type SignupKind,
} from "@/lib/supporters/signup-csv";
import styles from "./SignupUpload.module.css";
import { supportersCopy } from "./copy";

const copy = supportersCopy.signupUpload.help;

/** The words for yes, in short: enough to show how much it takes. */
const YES_WORDS = SIGNUP_YES.filter((word) => /^[a-z]/.test(word))
  .slice(0, 6)
  .concat("✓");

/**
 * What a file of the kind needs, in a few lines, to read before choosing
 * one, and the button that opens or closes the full list of column names
 * (SignupColumnNames).
 */
export default function SignupUploadHelp({
  kind = "paper",
  open,
  onToggle,
}: {
  kind?: SignupKind;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <ul className={styles.short}>
        {copy.short[kind].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div>
        {/* A triangle before it, as a fold's, pointing down while what it opens is open. */}
        <LinkButton onClick={onToggle}>
          <span className={styles.fold} aria-hidden="true" data-beside="lowercase">
            {open ? "▾" : "▸"}
          </span>
          {open ? copy.less : copy.more}
        </LinkButton>
      </div>
    </>
  );
}

/** Every column name a file of the kind can use, and the values each can hold. */
export function SignupColumnNames({ kind = "paper" }: { kind?: SignupKind }) {
  // A yes or no column's values: what's yes, then on its own line what's no.
  const yes = (
    <>
      {copy.yes(YES_WORDS.join(", "))}
      <br />
      {copy.no}
    </>
  );
  const fields = { ...copy.fields, ...(kind === "whatsapp" ? copy.whatsappFields : {}) };
  const required = (field: SignupField) => (REQUIRED[kind] as readonly SignupField[]).includes(field);
  return (
    <>
      <p>{copy.intro}</p>
      <Table>
        <thead>
          <tr>
            <th>{copy.columns.field}</th>
            <th>{copy.columns.names}</th>
            <th>{copy.columns.values}</th>
          </tr>
        </thead>
        <tbody>
          {KIND_FIELDS[kind].map((field) => (
            <tr key={field}>
              <td className={styles.nowrap}>
                {required(field) ? <Required>{fields[field].label}</Required> : fields[field].label}
              </td>
              <td>{SIGNUP_FIELD_NAMES[field].join(", ")}</td>
              <td>{fields[field].values}</td>
            </tr>
          ))}
          {kind === "paper" && (
            <tr>
              <td className={styles.nowrap}>{copy.event.label}</td>
              <td>{copy.event.names}</td>
              <td>{yes}</td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
}
