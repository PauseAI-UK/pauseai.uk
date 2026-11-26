import Image from "next/image";
import { site } from "@/lib/content/site";
import type { CoverageItem } from "@/lib/press/coverage";
import { ButtonAnchor } from "@/components/ui/Button";
import CoverageList from "./CoverageList";
import styles from "./PressKit.module.css";

// Media contact, boilerplate and brand assets in a column on the left, and
// the coverage on the right, so a visitor sees at once that the page has
// it. On a phone the column comes first.
export default function PressKit({ coverage }: { coverage: CoverageItem[] }) {
  return (
    <article className={styles.article}>
      <div className={`container ${styles.columns}`}>
        <div className={styles.kit}>
          <section className={styles.section} id="media-contact">
            <h2>Media contact</h2>
            <div className={styles.contact}>
              <p>
                For interviews, comment, or background on PauseAI UK, contact <strong>Joseph Miller</strong>, UK
                Director, at <a href={`mailto:${site.pressEmail}`}>{site.pressEmail}</a>.
              </p>
              <ButtonAnchor variant="primary" href={`mailto:${site.pressEmail}?subject=Press%20enquiry`}>
                Email press team
              </ButtonAnchor>
            </div>
          </section>

          <section className={styles.section} id="boilerplate">
            <h2>Boilerplate</h2>
            <p>
              PauseAI UK is the civic movement dedicated to averting the risks of superhuman AI. Volunteers organise
              across local groups in London, Scotland, Oxford, Leicester, Manchester, and the West of England, engaging
              MPs, joining conferences in the UK and European Parliaments, and marching in protests to push for a global
              pause on the development of AI systems more powerful than humans. PauseAI UK is strictly non-violent and
              is operated by Safe AI Alliance Ltd, a private company limited by guarantee.
            </p>
            <p>
              Read more on our <a href="/what-is-pauseai-uk/">what is PauseAI UK</a>,{" "}
              <a href="/track-record/">track record</a>, and <a href="/governance/">governance</a> pages.
            </p>
          </section>

          <section className={styles.section} id="brand-assets">
            <h2>Brand assets</h2>
            <p>
              High-resolution logos for editorial use. For photos of events or protests, contact the press team above.
            </p>
            <div className={styles.assets}>
              <a className={styles.assetCard} href="/images/logos/PauseAI-Logo-Transparent.svg" download>
                <Image src="/images/logos/PauseAI-Logo-Transparent.svg" alt="" width={178} height={48} />
                <span className={styles.assetCardLabel}>
                  Wordmark
                  <span className={styles.assetCardFormat}>SVG, transparent</span>
                </span>
              </a>
              <a className={styles.assetCard} href="/images/logos/Pause-Symbol.svg" download>
                <Image src="/images/logos/Pause-Symbol.svg" alt="" width={616} height={616} />
                <span className={styles.assetCardLabel}>
                  Symbol
                  <span className={styles.assetCardFormat}>SVG, transparent</span>
                </span>
              </a>
            </div>
          </section>
        </div>

        <section className={styles.section} id="coverage">
          <h2>Press coverage</h2>
          <CoverageList coverage={coverage} />
        </section>
      </div>
    </article>
  );
}
