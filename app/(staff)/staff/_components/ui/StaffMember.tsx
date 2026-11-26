import { Fragment } from "react";
import { staffMemberText } from "@/lib/staff-member";

/**
 * A staff member, named as staffMemberText names them, free to break
 * before the @ so a narrow column wraps it there. Every staff page names a
 * staff member with it, or with StaffSentence in a sentence.
 */
export default function StaffMember({ email }: { email: string }) {
  const [name, domain] = staffMemberText(email).split(/(?=@)/);
  return (
    <span>
      {name}
      {domain && (
        <>
          <wbr />
          {domain}
        </>
      )}
    </span>
  );
}

/** Stands for the staff member in a sentence, till StaffSentence puts them there. */
const WHO = "\u0000";

/**
 * A sentence of copy that names a staff member, `words` given who as a
 * string, with StaffMember where it names them.
 */
export function StaffSentence({ words, email }: { words: (who: string) => string; email: string }) {
  return words(WHO)
    .split(WHO)
    .map((part, i) => (
      <Fragment key={i}>
        {i > 0 && <StaffMember email={email} />}
        {part}
      </Fragment>
    ));
}
