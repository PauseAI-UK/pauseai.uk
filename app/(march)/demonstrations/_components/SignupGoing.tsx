"use client";

import type { ReactNode } from "react";
import { m } from "./classes";
import { useSignups } from "./MarchSignups";

/**
 * Under the hero's buttons, how many have registered, from the MarchSignups
 * around it, after `faces`: some of those going. Nothing when Luma can't say.
 */
export default function SignupGoing({ children: faces }: { children?: ReactNode }) {
  const signups = useSignups();
  if (signups === null) return null;
  return (
    <div className={m("hero-going")}>
      {faces}
      <p>
        Join <strong>{signups.toLocaleString("en-GB")}+</strong> people already registered
      </p>
    </div>
  );
}
