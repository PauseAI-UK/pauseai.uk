import Image from "next/image";
import type { CSSProperties } from "react";
import { m } from "./classes";

/*
 * The photo staircase, as on the roll-up banner: four columns of two photos
 * from earlier protests, each column a step higher than the one before,
 * rising across an orange band and running off both edges. They're there for
 * the feel of the march, so they're hidden from screen readers. On a phone
 * the last column goes, so the photos stay large enough to make out.
 */
const COLUMNS = [
  ["staircase-june-2025-1.jpg", "staircase-june-2025-2.jpg"],
  ["staircase-june-2025-3.jpg", "staircase-february-2026-1.jpg"],
  ["staircase-september-2026-1.jpg", "staircase-september-2026-2.jpg"],
  ["staircase-february-2026-2.jpg", "staircase-september-2026-3.jpg"],
];

/*
 * Coverage of PauseAI's protests and of the movement: each outlet's wordmark
 * in the body text's grey (public/images/march-signup/press, from Wikimedia
 * Commons, The Independent's from English Wikipedia), linked to the story
 * the march's Luma page cites. `h` is each logo's height, set by eye so wide
 * and stacked marks weigh the same, and `phoneH` its height on a phone.
 */
const PRESS = [
  {
    outlet: "BBC",
    href: "https://youtu.be/-0CRojvk1FE?t=146",
    logo: "bbc.svg",
    width: 560,
    height: 160,
    h: 22,
    phoneH: 18,
  },
  {
    outlet: "The Guardian",
    href: "https://www.theguardian.com/technology/2026/mar/06/uk-arts-must-not-be-sacrificed-for-speculative-ai-gains-peers-say",
    logo: "the-guardian.svg",
    width: 295,
    height: 97,
    h: 28,
    phoneH: 23,
  },
  {
    outlet: "MIT Technology Review",
    href: "https://www.technologyreview.com/2026/03/02/1133814/i-checked-out-londons-biggest-ever-anti-ai-protest/",
    logo: "mit-technology-review.svg",
    width: 184,
    height: 92,
    h: 32,
    phoneH: 26,
  },
  {
    outlet: "WIRED",
    href: "https://www.wired.it/article/movimenti-contro-intelligenza-artificiale-mappa-nomi-pauseai-stopai-controlai/",
    logo: "wired.svg",
    width: 125,
    height: 25,
    h: 20,
    phoneH: 16,
  },
  {
    outlet: "Business Insider",
    href: "https://www.businessinsider.com/protesters-accuse-google-deepmind-breaking-promises-ai-safety-2025-6",
    logo: "business-insider.svg",
    width: 1365,
    height: 120,
    h: 12,
    phoneH: 10,
  },
  {
    outlet: "The Wall Street Journal",
    href: "https://www.wsj.com/tech/ai/ai-companies-public-relations-ae312d79",
    logo: "wsj.svg",
    width: 797,
    height: 68,
    h: 13,
    phoneH: 11,
  },
  {
    outlet: "The Independent",
    href: "https://www.the-independent.com/tech/ai-safety-declaration-steve-bannon-b2932570.html",
    logo: "the-independent.svg",
    width: 4909,
    height: 351,
    h: 15,
    phoneH: 12,
  },
];

/** The photo staircase, and in its corner the press that has covered our protests. */
export default function SignupPhotos() {
  return (
    <section className={m("staircase-band")} aria-labelledby="press-title">
      <div className={m("staircase")} aria-hidden="true">
        <div className={m("staircase-stripe")} />
        <div className={m("staircase-photos")}>
          {COLUMNS.map((column) => (
            <div className={m("staircase-column")} key={column[0]}>
              {column.map((photo) => (
                <div className={m("staircase-photo")} key={photo}>
                  <Image src={`/images/march-signup/${photo}`} alt="" fill sizes="(max-width: 767px) 42vw, 30vw" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className={`container ${m("press")}`}>
        <p className={m("press-line")} id="press-title">
          When we march together, newspapers around the world cover our demonstrations
        </p>
        <ul className={m("press-logos")}>
          {PRESS.map((item) => (
            <li key={item.href}>
              <a href={item.href} target="_blank" rel="noreferrer">
                <Image
                  className={m("press-logo")}
                  src={`/images/march-signup/press/${item.logo}`}
                  alt={item.outlet}
                  width={item.width}
                  height={item.height}
                  style={{ "--logo-h": `${item.h}px`, "--logo-phone-h": `${item.phoneH}px` } as CSSProperties}
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
