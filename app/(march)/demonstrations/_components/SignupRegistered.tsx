import type { ReactNode } from "react";
import { m } from "./classes";

/**
 * Under a past march's button, how many registered for it, after `faces`:
 * some of them. Nothing when Luma can't say.
 */
export default function SignupRegistered({ count, children: faces }: { count: number | null; children?: ReactNode }) {
  if (count === null) return null;
  return (
    <div className={m("hero-going")}>
      {faces}
      <p>
        <strong>{count.toLocaleString("en-GB")}</strong> people registered
      </p>
    </div>
  );
}
