import Image from "next/image";
import GoingFaces from "@/components/events/GoingFaces";
import type { March } from "@/lib/content/march";
import type { FeaturedGuest } from "@/lib/going";
import { m } from "./classes";
import HeroFacts from "./HeroFacts";
import SignupGoing from "./SignupGoing";

/** How many of Luma's featured guests a hero shows. */
export const FACES = 3;

/**
 * The sign-up page's first screen: the march's name, when and where, the
 * buttons to the form and to the day's details, and under them how many
 * have registered, with the faces of the first `guests` Luma features. On a
 * desktop the words sit over the photo's darker side; on a phone the photo
 * is a block of its own at the top, fading into the words.
 */
export default function SignupHero({ march, guests = [] }: { march: March; guests?: FeaturedGuest[] }) {
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

        <HeroFacts march={march} />

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
