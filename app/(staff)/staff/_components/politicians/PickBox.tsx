"use client";

import { useEffect, useRef } from "react";
import { useSavedChoice } from "@/components/ui/useSave";
import type { FormResult } from "@/lib/form-result";
import { useTellPage } from "../ui/ResultForm";
import styles from "./PickBox.module.css";

/**
 * A tick box that saves as it's clicked, by `action`, with whether it's now
 * ticked; it shows the click at once, and what's saved once the page has
 * it. If saving fails, the click is undone and the box is marked as wrong,
 * until it's clicked again. A save that's refused is said at the page's
 * top, in the words for its reason (`says`), as what it's refused for, such
 * as its mailing having gone, often takes the box away as the page catches
 * up. `some` shows it part ticked, as the box over a list is when only some
 * of its rows are.
 */
export default function PickBox<Reason extends string = never>({
  ticked,
  some = false,
  label,
  action,
  says,
}: {
  ticked: boolean;
  some?: boolean;
  label: string;
  action: (ticked: boolean) => Promise<FormResult<Reason>>;
  says: Record<Reason, string>;
}) {
  const tell = useTellPage();
  const [shown, choose, pending, failed] = useSavedChoice(ticked, action, (now) => now, {
    done: (result) => {
      if (!result.ok) tell(says[result.reason as Reason]);
    },
  });
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    box.current!.indeterminate = some && !pending;
  }, [some, pending]);
  return (
    <input
      ref={box}
      type="checkbox"
      className={styles.box}
      aria-label={label}
      checked={shown}
      aria-invalid={failed || undefined}
      onChange={(event) => choose(event.target.checked)}
    />
  );
}
