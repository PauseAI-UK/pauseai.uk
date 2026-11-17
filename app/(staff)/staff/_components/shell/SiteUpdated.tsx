"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { reloadPage } from "@/lib/leave-page.client";
import { keepsDraft, watchStaleActions } from "./stale-actions.client";
import styles from "./SiteUpdated.module.css";
import { shellCopy } from "./copy";

const copy = shellCopy.siteUpdated;

/**
 * Over the page, once a button or form has called a Server Action the site
 * no longer has, as a deploy since the page was opened renamed, moved or
 * removed it: that the site's been updated, with Reload. Its × closes it,
 * to copy something off the page first; the next such call opens it again.
 * On a page with a draft writer (useDraftWriter), it says the draft's
 * changes are kept.
 * Every signed-in staff page has it (the signed-in layout), so no button
 * needs to.
 */
export default function SiteUpdated() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kept, setKept] = useState(false);
  useEffect(
    () =>
      watchStaleActions(() => {
        setKept(keepsDraft());
        // showModal gives the focus trap, Escape to close and the backdrop.
        if (!dialog.current!.open) dialog.current!.showModal();
      }),
    [],
  );
  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="site-updated-title">
      <button type="button" className={styles.close} aria-label={copy.close} onClick={() => dialog.current!.close()}>
        ×
      </button>
      <h2 id="site-updated-title" className={styles.title}>
        {copy.title}
      </h2>
      <p>{copy.words}</p>
      {kept && <p>{copy.kept}</p>}
      <Button variant="primary" fit onClick={reloadPage}>
        {copy.reload}
      </Button>
    </dialog>
  );
}
