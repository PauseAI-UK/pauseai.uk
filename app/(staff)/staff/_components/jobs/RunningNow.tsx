"use client";

import type { ReactNode } from "react";
import { useReadAgain } from "@/components/ui/useReadAgain";
import Strip from "../ui/Strip";
import styles from "./RunningNow.module.css";

/** How often a job's page asks again whether its run has ended. */
const READ_AGAIN_MS = 3000;

/**
 * On a job's page, while a run of it is going: a blue strip saying so, set
 * off from the band above and the runs below, and the page asked for again
 * every few seconds, which leaves this out, and shows the run in the log,
 * once it has ended.
 */
export default function RunningNow({ children }: { children: ReactNode }) {
  useReadAgain(READ_AGAIN_MS);
  return (
    <div className={styles.running}>
      <Strip tone="blue">
        <span>{children}</span>
      </Strip>
    </div>
  );
}
