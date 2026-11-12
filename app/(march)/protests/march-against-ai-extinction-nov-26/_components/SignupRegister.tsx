import type { MarchRegisterResult } from "@/lib/march-registration";
import { m } from "./classes";
import Marker from "./Marker";
import SignupFlow from "./SignupFlow";

/** The register band: what to expect, and the form and the cards after it. Its props are SignupFlow's. */
export default function SignupRegister({ register }: { register?: (input: unknown) => Promise<MarchRegisterResult> }) {
  return (
    <section id="register" className={m("band")} aria-labelledby="register-title">
      <div className={`container ${m("split register")}`}>
        <div className={m("stack prose")}>
          <h2 className={m("heading")} id="register-title">
            <Marker type="highlight">Register for the march</Marker>
          </h2>
          <p>Registering helps us know how many people to expect and lets us keep you updated before the day.</p>

          <div className={m("stack-tight register-expect")}>
            <h3 className={m("subheading")}>What to expect</h3>
            <ul className={m("register-list")}>
              <li>
                This event will be <strong>family friendly, law-abiding and strictly non-violent</strong>.
              </li>
              <li>
                PauseAI is a <strong>big tent</strong> movement. Everyone is welcome, whatever their politics.
              </li>
              <li>We will coordinate with the police ahead of the march.</li>
            </ul>
          </div>
        </div>

        <SignupFlow register={register} />
      </div>
    </section>
  );
}
