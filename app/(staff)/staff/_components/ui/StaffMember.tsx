import { staffMemberText } from "@/lib/staff-member";

/**
 * A staff member, named as staffMemberText names them, free to break before
 * an address's @ so a narrow column wraps it there. Every staff page names
 * a staff member with it.
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
