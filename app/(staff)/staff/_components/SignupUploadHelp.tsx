import LinkButton from "@/components/ui/LinkButton";
import Required from "@/components/ui/Required";
import Table from "@/components/ui/Table";
import { staffCopy } from "@/lib/content/staff-interface";
import { SIGNUP_FIELD_NAMES, SIGNUP_FIELDS, SIGNUP_YES } from "@/lib/signup-upload";
import styles from "./SignupUpload.module.css";

const copy = staffCopy.signupUpload.help;

/** The words for yes, in short: enough to show how much it takes. */
const YES_WORDS = SIGNUP_YES.filter((word) => /^[a-z]/.test(word))
  .slice(0, 6)
  .concat("✓");

/**
 * What the file needs, in a few lines, to read before choosing one, and the
 * button that opens or closes the full list of column names (SignupColumnNames).
 */
export default function SignupUploadHelp({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <>
      <ul className={styles.short}>
        {copy.short.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div>
        {/* A triangle before it, as a fold's, pointing down while what it opens is open. */}
        <LinkButton onClick={onToggle}>
          <span className={styles.fold} aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
          {open ? copy.less : copy.more}
        </LinkButton>
      </div>
    </>
  );
}

/** Every column name the file can use, and the values each can hold. */
export function SignupColumnNames() {
  // A yes or no column's values: what's yes, then on its own line what's no.
  const yes = (
    <>
      {copy.yes(YES_WORDS.join(", "))}
      <br />
      {copy.no}
    </>
  );
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
          {SIGNUP_FIELDS.map((field) => (
            <tr key={field}>
              <td className={styles.nowrap}>
                {field === "name" || field === "email" ? (
                  <Required>{copy.fields[field].label}</Required>
                ) : (
                  copy.fields[field].label
                )}
              </td>
              <td>{SIGNUP_FIELD_NAMES[field].join(", ")}</td>
              <td>{copy.fields[field].values}</td>
            </tr>
          ))}
          <tr>
            <td className={styles.nowrap}>{copy.event.label}</td>
            <td>{copy.event.names}</td>
            <td>{yes}</td>
          </tr>
        </tbody>
      </Table>
    </>
  );
}
