"use client";

import { useState } from "react";
import Alert from "../Alert";
import Notice from "../ui/Notice";
import { accountsCopy } from "./copy";

/**
 * After a change on the accounts page that was refused: why, as an error.
 * Just after a removal: what it leaves them, in a Notice, till its ×
 * closes it. Nothing otherwise.
 */
export default function AccountsNotice({ notice }: { notice: string }) {
  const [open, setOpen] = useState(true);
  if (notice === "last-admin") return <Alert>{accountsCopy.accounts.lastAdmin}</Alert>;
  if (notice === "not-pauseai") return <Alert>{accountsCopy.accounts.notPauseai}</Alert>;
  return (
    <span role="status">
      {notice === "removed" && open && (
        <Notice close={accountsCopy.accounts.closeRemoved} onClose={() => setOpen(false)}>
          {accountsCopy.accounts.removeNote}
        </Notice>
      )}
    </span>
  );
}
