import Image from "next/image";
import GoingFaces from "@/components/events/GoingFaces";
import { march } from "@/lib/content/march";
import type { FeaturedGuest } from "@/lib/going";
import { m } from "./classes";
import SignupGoing from "./SignupGoing";

/** How many of Luma's featured guests the hero shows. */
const FACES = 3;

/**
 * The sign-up page's first screen: the march's name, when and where, the
 * buttons to the form and to the day's details, and under them how many
 * have registered, with the faces of the first `guests` Luma features. On a
 * desktop the words sit over the photo's darker side; on a phone the photo
 * is a block of its own at the top, fading into the words.
 */
export default function SignupHero({ guests = [] }: { guests?: FeaturedGuest[] }) {
  return (
    <section className={m("hero")}>
      <div className={m("hero-photo")}>
        <Image src="/images/march-signup/hero-march.jpg" alt="" fill sizes="100vw" priority />
      </div>
      <div className={`container ${m("hero-inner")}`}>
        <h1 className={m("hero-title")}>
          <span>March Against</span> <span className={m("hero-title-hit")}>AI Extinction</span>
        </h1>

        <p className={m("hero-lede")}>Join us for the biggest ever demonstration for AI safety</p>

        <div className={m("hero-facts")}>
          <div className={m("hero-fact")}>
            <Icon name="calendar" />
            <p>
              <time dateTime={march.dateIso}>{march.dateLong}</time>
              <br />
              {march.time}
            </p>
          </div>
          <div className={m("hero-fact")}>
            <Icon name="map-pin" />
            <p>
              {march.city}
              <br />
              <span className={m("hero-route")}>
                {march.start.name}
                <Icon name="arrow-right" label="to" />
                {march.end.name}
              </span>
            </p>
          </div>
        </div>

        <div className={m("hero-cta")}>
          <a className={m("btn")} href="#register">
            Register now
          </a>
          <a className={m("btn btn-light")} href="#on-the-day">
            See all details
          </a>
        </div>

        <SignupGoing>{guests.length > 0 && <GoingFaces guests={guests.slice(0, FACES)} />}</SignupGoing>
      </div>
    </section>
  );
}

/** Lucide's icons, as the site's own are: thin strokes in the text's colour. */
function Icon({ name, label }: { name: keyof typeof ICONS; label?: string }) {
  return (
    <svg
      className={m(name === "arrow-right" ? "hero-route-arrow" : "hero-icon")}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {ICONS[name]}
    </svg>
  );
}

const ICONS = {
  calendar: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
};
