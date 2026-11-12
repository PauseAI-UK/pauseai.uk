"use client";

import { useState, type ReactNode } from "react";
import styles from "./Gallery.module.css";

/**
 * Holds a controlled input's value, so the example works: dragging a slider
 * moves it, picking an option selects it. The value shows beside it.
 */
export function Controlled<T>({
  initial,
  show = (value) => JSON.stringify(value),
  children,
}: {
  initial: T;
  show?: (value: T) => string;
  children: (value: T, set: (value: T) => void) => ReactNode;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      {children(value, setValue)}
      <p className={styles.note}>Value: {show(value)}</p>
    </>
  );
}

/**
 * How an argument reads in the event log: a file by its name, a form's data
 * as its fields (what a Server Action would get), a DOM event as "event", the
 * rest as JSON.
 */
function describe(arg: unknown): string {
  if (arg instanceof File) return `File ${arg.name}`;
  if (arg instanceof FormData) return JSON.stringify(Object.fromEntries(arg));
  if (arg instanceof Event || (typeof arg === "object" && arg !== null && "nativeEvent" in arg)) return "event";
  if (typeof arg === "function") return "ƒ";
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

type Log = (name: string) => (...args: unknown[]) => void;

/** A `log` that passes each call to `add` as "name(…)", and gives the same function each time it's asked for a name. */
function logTo(add: (call: string) => void): Log {
  const made = new Map<string, (...args: unknown[]) => void>();
  return (name) => {
    let logs = made.get(name);
    if (!logs) {
      logs = (...args) => add(`${name}(${args.map(describe).join(", ")})`);
      made.set(name, logs);
    }
    return logs;
  };
}

/**
 * Gives an example's action callbacks something to do: `log("onSave")` is a
 * function that adds "onSave(…)" to a list under the component. It's the
 * same function for the same name at every render, so it can go to a prop
 * an effect depends on without the effect running again after each log.
 */
export function Logged({ children }: { children: (log: Log) => ReactNode }) {
  const [calls, setCalls] = useState<string[]>([]);
  const [log] = useState(() => logTo((call) => setCalls((list) => [...list, call])));
  return (
    <>
      {children(log)}
      <ol className={styles.log} aria-label="Event log">
        {calls.map((call, i) => (
          <li key={i}>{call}</li>
        ))}
      </ol>
    </>
  );
}
