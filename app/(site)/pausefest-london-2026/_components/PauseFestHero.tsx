import Image from "next/image";
import styles from "./PauseFestHero.module.css";

/** PauseFest's first screen, as its poster: the name, where and when, and the logo on an orange band, over the march. */
export default function PauseFestHero() {
  return (
    <header className={styles.hero}>
      <div className={styles.band}>
        <div className={`container ${styles.inner}`}>
          <h1 className={styles.title}>
            Pause<span className={styles.fest}>Fest</span>
          </h1>
          <p className={styles.whereWhen}>
            London 2026
            <br />
            20<sup>th</sup> – 23<sup>rd</sup> Nov
          </p>
          <Image
            className={styles.logo}
            src="/images/logos/PauseAI-Logo-Transparent.svg"
            alt="PauseAI"
            width={178}
            height={48}
            priority
          />
        </div>
      </div>
      <div className={styles.photo}>
        <Image
          src="/images/march-signup/protest-pauseai-banner.jpg"
          alt="Marchers behind a PauseAI banner, holding placards"
          fill
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 62%" }}
          priority
        />
      </div>
    </header>
  );
}
