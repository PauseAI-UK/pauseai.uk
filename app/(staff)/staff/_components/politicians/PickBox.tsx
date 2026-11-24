"use client";

import { useEffect, useRef } from "react";
import { useSavedChoice } from "@/components/ui/useSave";
import styles from "./PickBox.module.css";

/**
 * A tick box that saves as it's clicked, by `action`, with whether it's now
 * ticked; it shows the click at once, and what's saved once the page has
 * it. If saving fails, the click is undone and the box is marked as wrong,
 * until it's clicked again. `some` shows it part ticked, as the box over a
 * list is when only some of its rows are.
 */
export default function PickBox({
  ticked,
  some = false,
  label,
  action,
}: {
  ticked: boolean;
  some?: boolean;
  label: string;
  action: (ticked: boolean) => Promise<void>;
}) {
  const [shown, choose, pending, failed] = useSavedChoice(ticked, action, (now) => now);
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
