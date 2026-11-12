import { marchSignupCopy } from "@/lib/content/march-signup";
import { m } from "./classes";

/** How many have registered for the march, in the form's top corner; nothing when Luma can't say. */
export default function SignupCount({ count }: { count: number | null }) {
  if (count === null) return null;
  return (
    <p className={m("signup-count")}>
      {count.toLocaleString("en-GB")} {marchSignupCopy.form.count}
    </p>
  );
}
