import Table from "@/components/ui/Table";
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import { SIGNUP_FIELD_NAMES, SIGNUP_FIELDS, SIGNUP_YES } from "@/lib/signup-upload";
import styles from "./SignupUpload.module.css";

const copy = staffCopy.signupUpload.help;

/** The words for yes, in short: enough to show how much it takes, without the ticks a heading can't show. */
const YES_WORDS = SIGNUP_YES.filter((word) => /^[a-z]/.test(word))
  .slice(0, 6)
  .concat("✓");

/** The columns the page understands, what they can be headed and what they can hold, to read before choosing a file. */
export default function SignupUploadHelp() {
  const yes = copy.yes(YES_WORDS.join(", "));
  return (
    <section className={styles.help}>
      <h2>{copy.title}</h2>
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
              <td>{copy.fields[field].label}</td>
              <td>{SIGNUP_FIELD_NAMES[field].join(", ")}</td>
              <td>{field === "mailingList" ? yes : copy.fields[field].values}</td>
            </tr>
          ))}
          <tr>
            <td>{copy.event.label}</td>
            <td>{copy.event.names}</td>
            <td>{yes}</td>
          </tr>
        </tbody>
      </Table>
      <p>
        <Muted>{copy.ignored}</Muted>
      </p>
    </section>
  );
}
