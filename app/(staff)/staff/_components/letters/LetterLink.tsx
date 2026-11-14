import StaffLink from "../ui/StaffLink";
import type { SentLetter } from "@/lib/email/email.server";
import { emailCopy } from "@/lib/email/copy";

/** A letter an email was, by whom it was to, linked to its page when `linked`, as only staff with `supporters` can open it. */
export default function LetterLink({ letter, linked }: { letter: SentLetter; linked: boolean }) {
  const words = `${emailCopy.emails.letterTo} ${letter.to}`;
  return linked ? <StaffLink href={`/staff/letters/${letter.id}`}>{words}</StaffLink> : <>{words}</>;
}
