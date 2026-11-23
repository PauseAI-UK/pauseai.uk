import Link from "next/link";
import GoingFaces from "@/components/events/GoingFaces";
import { march as nextMarch, novemberMarchFilm, type March } from "@/lib/content/march";
import type { FeaturedGuest } from "@/lib/going";
import { m } from "./classes";
import HeroFacts from "./HeroFacts";
import { FACES } from "./SignupHero";
import SignupRegistered from "./SignupRegistered";

/**
 * The first screen of a past march's page: a label saying it's past, its
 * name, what we said of the day, when and where it took place, and how many
 * `registered`, with the faces of the first `guests` Luma features. Under
 * them a card for the next march:
 * its date and place, and a button to its sign-up. Beside them all the film
 * of the day, to play: on a phone, above them. The film shows a still
 * from itself until it's played, and loads nothing before.
 */
export default function PastHero({
  march,
  registered = null,
  guests = [],
}: {
  march: March;
  /** How many registered for it: null when Luma can't say. */
  registered?: number | null;
  guests?: FeaturedGuest[];
}) {
  return (
    <section className={m("hero hero-past")}>
      <div className={`container ${m("hero-inner hero-two")}`}>
        <div className={m("hero-words")}>
          <p className={m("hero-past-label")}>Past march</p>
          <h1 className={m("hero-title")}>
            <span>March Against</span> <span className={m("hero-title-hit")}>AI Extinction</span>
          </h1>

          <p className={m("hero-lede")}>What. A. Day.</p>
          <div className={m("hero-said")}>
            <p>Over 1,000 people marched against AI extinction, right through the heart of London.</p>
            <p>If you made a sign, brought a friend or gave up your Saturday to help run the march, thank you. 🧡</p>
          </div>

          <HeroFacts march={march} past />

          <SignupRegistered count={registered}>
            {guests.length > 0 && <GoingFaces guests={guests.slice(0, FACES)} />}
          </SignupRegistered>

          <div className={m("hero-next")}>
            <p>
              <span className={m("hero-next-label")}>Next march</span>
              <strong>
                <time dateTime={nextMarch.dateIso}>{nextMarch.dateLong}</time> · {nextMarch.city}
              </strong>
            </p>
            <Link className={m("btn")} href={nextMarch.path}>
              Register
            </Link>
          </div>
        </div>

        <video
          className={m("hero-film")}
          src={novemberMarchFilm.src}
          poster={novemberMarchFilm.poster}
          controls
          playsInline
          preload="none"
          aria-label={novemberMarchFilm.label}
        />
      </div>
    </section>
  );
}
