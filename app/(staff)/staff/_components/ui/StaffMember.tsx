"use client";

import { useId } from "react";
import Bubble from "@/components/ui/Bubble";
import { staffMemberText } from "@/lib/staff-member";
import { useStaffName } from "./StaffNames";
import styles from "./StaffMember.module.css";

/** The address, free to break before its @ so a narrow column wraps it there. */
function Address({ email }: { email: string }) {
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

/**
 * A staff member, named as staffMemberText names them. Every staff page
 * names a staff member with it. Where their name is known (StaffNames), the
 * address is a button, underlined with dots, that opens a bubble with their
 * name. `plain` is for an address inside a link or button, which can't hold
 * another, and shows the address alone.
 */
export default function StaffMember({ email, plain = false }: { email: string; plain?: boolean }) {
  // Letters and digits alone, as it also names the bubble's anchor in CSS (bubbleTrigger).
  const id = `staff-member-${useId().replace(/[^\w-]/g, "")}`;
  const name = useStaffName(email);
  if (plain || !name) return <Address email={email} />;
  return (
    <Bubble id={id} trigger={styles.member} label={<Address email={email} />} inline>
      {name}
    </Bubble>
  );
}
