"use client";

import { useRef, useSyncExternalStore } from "react";
import { navFoldCookie } from "@/lib/staff-nav";
import styles from "./NavFold.module.css";
import { shellCopy } from "../shell/copy";

/** Tells this page's NavFold the sidebar has folded or unfolded. */
const EVENT = "staff-nav-fold";

const subscribe = (change: () => void) => {
  window.addEventListener(EVENT, change);
  return () => window.removeEventListener(EVENT, change);
};
/** The box around the staff pages, from the button in it, that says whether the sidebar is folded (app/(staff)/layout.tsx). */
const staffBox = (button: HTMLElement | null) => button?.closest<HTMLElement>("[data-staff-nav]");

/**
 * The round button on the staff sidebar's edge, by its title, that folds it
 * to a rail of icons, and unfolds it: on the box around the staff pages,
 * and remembered in a cookie the next page is drawn from (lib/staff-nav.ts).
 * A chevron, pointing the way the sidebar will go. Wider screens only; a
 * phone has the bar instead.
 */
export default function NavFold() {
  const button = useRef<HTMLButtonElement>(null);
  // Before it's drawn there's no box to read, so it says open, and React reads it again once it is.
  const folded = useSyncExternalStore(
    subscribe,
    () => staffBox(button.current)?.dataset.staffNav === "folded",
    () => false,
  );
  const toggle = () => {
    staffBox(button.current)!.dataset.staffNav = folded ? "open" : "folded";
    document.cookie = navFoldCookie(!folded);
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <button
      ref={button}
      type="button"
      className={styles.fold}
      aria-expanded={!folded}
      aria-label={folded ? shellCopy.nav.unfold : shellCopy.nav.fold}
      onClick={toggle}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={styles.chevron}
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );
}
