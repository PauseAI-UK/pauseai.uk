import { march } from "@/lib/content/march";
import { site } from "@/lib/content/site";
import { m } from "./classes";
import Marker from "./Marker";

const mapUrl = (stop: { name: string; area: string }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stop.name}, ${stop.area}`)}`;

const STOPS = [
  { kind: "From", stop: march.start },
  { kind: "To", stop: march.end },
];

/**
 * On the day: when and the route, under the heading, and beside them what
 * to bring and how to help. The hero's See all details comes here.
 */
export default function SignupDay() {
  return (
    <section id="on-the-day" className={m("band band-white")} aria-labelledby="day-title">
      <div className={`container ${m("split")}`}>
        <div className={m("stack")}>
          <h2 className={m("heading")} id="day-title">
            <Marker type="highlight">On the day</Marker>
          </h2>
          <div className={m("route prose")}>
            <p className={m("route-when")}>
              <time dateTime={march.dateIso}>{march.dateLong}</time>, {march.time}
            </p>
            {STOPS.map(({ kind, stop }) => (
              <p key={kind}>
                <strong>{kind}</strong>{" "}
                <a className={m("text-link")} href={mapUrl(stop)} target="_blank" rel="noreferrer">
                  {stop.name}
                </a>
                , {stop.area}
              </p>
            ))}
          </div>
        </div>

        <div className={m("stack-loose prose")}>
          <div className={m("stack-tight")}>
            <h3 className={m("subheading")}>What to bring</h3>
            <p>
              Bring a poster or sign if you can, but most of all, bring a friend or family member. We need every person
              to step up and help bring about an actual change to the law.
            </p>
          </div>
          <div className={m("stack-tight")}>
            <h3 className={m("subheading")}>Get involved</h3>
            <p>
              We&rsquo;re looking for volunteers to help with{" "}
              <a className={m("text-link")} href={site.social.luma} target="_blank" rel="noreferrer">
                tabling and flyering
              </a>{" "}
              to advertise the protest. If you&rsquo;re interested in volunteering for several hours a week, please
              email{" "}
              <a className={m("text-link")} href={`mailto:${site.contactEmail}`}>
                {site.contactEmail}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
