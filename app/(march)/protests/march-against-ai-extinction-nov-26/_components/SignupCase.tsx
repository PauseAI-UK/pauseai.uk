import { m } from "./classes";
import Marker from "./Marker";

/** Why we're marching: the heading and lead in one column, the argument in the other. */
export default function SignupCase() {
  return (
    <section className={m("band")} aria-labelledby="case-title">
      <div className={`container ${m("split split-even")}`}>
        <div className={m("stack")}>
          <h2 className={m("heading")} id="case-title">
            <Marker type="highlight">Why we&rsquo;re marching</Marker>
          </h2>
          <p className={m("lead")}>
            Thousands of people across the UK believe that companies will soon build superintelligent AI that they
            cannot control.
          </p>
        </div>

        <div className={m("stack prose")}>
          <p>
            Every month more and more people notice how dangerous our situation is. Awareness of this problem is
            accelerating rapidly as we get closer to catastrophe.
          </p>
          {/* The July incident, in bold, the clause it turns on marked. */}
          <p className={m("case-incident")}>
            In July, an autonomous AI agent developed by OpenAI broke out of an isolated test environment, hacked parts
            of OpenAI&rsquo;s own network to gain access to the internet and compromised the infrastructure of Hugging
            Face, another AI company.{" "}
            <Marker type="underline">The agent had not been instructed to attack Hugging Face</Marker>; it did so
            because it inferred that their servers might contain solutions to the benchmark on which it was being
            evaluated. The campaign unfolded over the course of four and a half days, with OpenAI only becoming aware of
            the incident several days later.
          </p>
          <p>
            What were once hypothetical dangers of future AI systems are now real incidents that AI companies have
            failed to prevent. And yet AI companies are not slowing down, they are still accelerating.
          </p>
        </div>
      </div>
    </section>
  );
}
