import Image from "next/image";
import styles from "./PauseFestHero.module.css";

/** PauseFest's first screen, as its flyer: the name, where and when on an orange band, over the march's placards. */
export default function PauseFestHero() {
  return (
    <header className={styles.hero}>
      <div className={styles.band}>
        <div className={`container ${styles.inner}`}>
          <h1 className={styles.title}>
            Pause<span className={styles.fest}>Fest</span>
          </h1>
          <Image
            className={styles.logo}
            src="/images/logos/PauseAI-Logo-Transparent.svg"
            alt="PauseAI"
            width={178}
            height={48}
            priority
          />
          <p className={styles.where}>London 2026</p>
          <p className={styles.when}>
            20<sup>th</sup> – 23<sup>rd</sup> November
          </p>
        </div>
      </div>
      <div className={styles.photo}>
        <Image
          src="/images/pausefest/march-placards.jpg"
          alt={`Marchers holding PauseAI placards, one reading "Don't let AI decide your future"`}
          fill
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 75%" }}
          priority
        />
      </div>
    </header>
  );
}
