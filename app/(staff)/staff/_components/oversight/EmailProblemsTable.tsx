import Table from "@/components/ui/Table";
import { Muted } from "@/components/ui/Text";
import type { ProblemSummary } from "@/lib/email/email.server";
import LetterLink from "../letters/LetterLink";
import Reason from "../email/BounceReason";
import When from "../ui/When";
import styles from "./EmailProblemsTable.module.css";
import { emailCopy } from "@/lib/email/copy";

/** The latest bounces and complaints, soft bounces too, and what each email was: a letter, linked to it with `letterLinks`. */
export default function EmailProblemsTable({
  problems,
  letterLinks,
}: {
  problems: ProblemSummary[];
  letterLinks: boolean;
}) {
  if (problems.length === 0) return <p>{emailCopy.emails.noProblems}</p>;
  const columns = emailCopy.emails.columns;
  return (
    <Table>
      <thead>
        <tr>
          <th>{columns.at}</th>
          <th>{columns.address}</th>
          <th>{columns.kind}</th>
          <th>{columns.reason}</th>
          <th>{columns.sent}</th>
        </tr>
      </thead>
      <tbody>
        {problems.map((problem) => (
          <tr key={problem.id}>
            <td>
              <When at={problem.at} />
            </td>
            <td>{problem.address}</td>
            <td className={styles.short}>{emailCopy.emails.kinds[problem.kind]}</td>
            <td>
              <Reason reason={problem.reason} kind={problem.kind} foundInGmail={problem.foundInGmail} />
            </td>
            <td>
              {problem.letter ? (
                <LetterLink letter={problem.letter} linked={letterLinks} />
              ) : problem.purpose ? (
                emailCopy.emails.purposes[problem.purpose]
              ) : (
                <Muted>{emailCopy.emails.notRecorded}</Muted>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
