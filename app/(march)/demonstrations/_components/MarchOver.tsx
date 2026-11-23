import Link from "next/link";
import { march } from "@/lib/content/march";
import { m } from "./classes";
import Marker from "./Marker";

/**
 * The last band of a past march's page, where the sign-up has its form:
 * the march is over, with the way to the next march's sign-up and to the
 * home page's Join.
 */
export default function MarchOver() {
  return (
    <section className={m("band")} aria-labelledby="over-title">
      <div className={`container ${m("stack")}`}>
        <h2 className={m("heading")} id="over-title">
          <Marker type="highlight">⁂ This march has happened</Marker>
        </h2>
        <p className={m("lead")}>⁂ Thank you to everyone who marched with us. There’s another march coming.</p>
        <div className={m("over-actions")}>
          <Link className={m("btn")} href={march.path}>
            ⁂ Register for the next march
          </Link>
          <Link className={m("btn btn-light")} href="/#join">
            ⁂ Join PauseAI UK
          </Link>
        </div>
      </div>
    </section>
  );
}
