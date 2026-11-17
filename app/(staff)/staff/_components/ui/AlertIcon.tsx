import styles from "./AlertIcon.module.css";

/** A circle's outline, which every icon but the triangle is drawn in. */
const RING = "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16z";

/**
 * The icons' shapes: an exclamation mark for something to see to, a warning
 * triangle for something broken, a play for something going, and a clock for
 * waiting on something else, in any tone.
 */
const PATHS = {
  amber: `${RING}M11 7v6h2V7h-2zm0 8v2h2v-2h-2z`,
  red: "M12 2 1 21h22L12 2zm0 4.8L19.5 19h-15L12 6.8zM11 10v5h2v-5h-2zm0 6v2h2v-2h-2z",
  blue: `${RING}M10 8v8l6-4-6-4z`,
};
const CLOCK = `${RING}M11 7v6l4.6 2.7 1-1.7-3.6-2.1V7h-2z`;

/**
 * A small icon at the start of an alert, in its status colour: amber for
 * something to see to, red for broken, blue for going; `waiting`, a clock
 * instead, for waiting on someone else. Decorative: the words say it.
 */
export default function AlertIcon({ tone, waiting = false }: { tone: keyof typeof PATHS; waiting?: boolean }) {
  return (
    <svg className={`${styles.icon} ${styles[tone]}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={waiting ? CLOCK : PATHS[tone]} />
    </svg>
  );
}
