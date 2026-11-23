import { march, novemberMarch } from "@/lib/content/march";
import { m } from "./classes";
import Marker from "./Marker";

type Step = { date: string; figure: string; note: string; goal?: boolean };

/* The turnouts so far, oldest first. */
const TURNOUT: Step[] = [
  { date: "June 2025", figure: "60", note: "Our biggest protest of 2025" },
  { date: "February 2026", figure: "300", note: "Five times bigger" },
  { date: novemberMarch.dateWritten, figure: "⁂ 000", note: "⁂ Our biggest march so far" },
];

/* The next march's, the number we hope for. */
const GOAL: Step = { date: march.dateWritten, figure: "⁂ 0,000", note: "Our goal this time", goal: true };

/**
 * Our protests are growing: the turnouts so far, then, on the sign-up, the
 * next march's goal, circled. The page of a march that's `past` ends at its
 * own turnout.
 */
export default function SignupTurnout({ past = false }: { past?: boolean }) {
  const steps = past ? TURNOUT : [...TURNOUT, GOAL];
  return (
    <section className={m("band band-turnout")} aria-labelledby="turnout-title">
      <div className={`container ${m("stack-wide")}`}>
        <div className={m("stack")}>
          <h2 className={m("heading")} id="turnout-title">
            Our protests are growing
          </h2>
          <p className={m("turnout-intro")}>
            For the past 3 years,{" "}
            <strong>PauseAI UK has consistently held the largest rallies for AI safety in the world</strong>.{" "}
            {past
              ? "⁂ Each time has been bigger than the last."
              : "Each time is bigger than the last and this march will be no exception."}
          </p>
        </div>
        <ol className={m("turnout")}>
          {steps.map((step) => (
            <li key={step.date}>
              <p className={m("turnout-date")}>{step.date}</p>
              <p className={m("turnout-figure")}>
                {step.goal ? <Marker type="circle">{step.figure}</Marker> : step.figure}
              </p>
              <p>{step.note}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
