import { march } from "@/lib/content/march";
import { m } from "./classes";
import Marker from "./Marker";

/* The turnout, as three numbers, the last the goal. */
const TURNOUT = [
  { date: "June 2025", figure: "60", note: "Our biggest protest of 2025", goal: false },
  { date: "February 2026", figure: "300", note: "Five times bigger", goal: false },
  { date: march.dateWritten, figure: "1,000", note: "Our goal this time", goal: true },
];

/** Our protests are growing: the three turnouts, the goal circled. */
export default function SignupTurnout() {
  return (
    <section className={m("band band-turnout")} aria-labelledby="turnout-title">
      <div className={`container ${m("stack-wide")}`}>
        <div className={m("stack")}>
          <h2 className={m("heading")} id="turnout-title">
            Our protests are growing
          </h2>
          <p className={m("turnout-intro")}>
            For the past 3 years,{" "}
            <strong>PauseAI UK has consistently held the largest rallies for AI safety in the world</strong>. Each time
            is bigger than the last and this march will be no exception.
          </p>
        </div>
        <ol className={m("turnout")}>
          {TURNOUT.map((step) => (
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
