import { m } from "./classes";
import Marker from "./Marker";

/**
 * What we want, as the march's Luma page puts it: a global treaty and UK
 * legislation side by side, then the march's demand, the call to the Prime
 * Minister highlighted.
 */
export default function SignupDemand() {
  return (
    <section className={m("band band-white")} aria-labelledby="demand-title">
      <div className={`container ${m("stack-wide")}`}>
        <h2 className={m("heading")} id="demand-title">
          <Marker type="highlight">What we want</Marker>
        </h2>

        <div className={m("pair")}>
          <div className={m("stack-tight prose")}>
            <h3 className={m("subheading")}>A global treaty to pause frontier AI development</h3>
            <p>
              Implement a global, temporary pause on the training of the most powerful general AI systems, until we know
              how to build them safely and keep them under democratic control.
            </p>
            <p>
              <a className={m("text-link")} href="https://pauseai.info/proposal" target="_blank" rel="noreferrer">
                See the full proposal
              </a>
            </p>
          </div>
          <div className={m("stack-tight prose")}>
            <h3 className={m("subheading")}>Frontier AI legislation</h3>
            <p>
              The UK has no specific legal standards for AI. No regulator oversees frontier AI development. And UK law
              does not reliably hold developers liable for damage or deaths caused by their models, even when the danger
              is predictable, preventable and uniquely enabled by AI. In short,{" "}
              <strong>
                UK law neither requires developers to guard against frontier AI risks, nor exposes them to any financial
                consequence if they fail to do so.
              </strong>
            </p>
          </div>
        </div>

        <div className={m("statement")}>
          <p>It&rsquo;s time for the government to step in.</p>
          <p>
            <Marker type="highlight">
              We call on the Prime Minister to introduce frontier AI legislation to prevent catastrophe.
            </Marker>
          </p>
        </div>
      </div>
    </section>
  );
}
