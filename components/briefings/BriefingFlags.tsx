import Image from "next/image";
import styles from "./BriefingFlags.module.css";

/** A country, by its two-letter code ("fr"), whose flag is /images/briefings/flags/<code>.png. */
export type Country = { code: string; name: string };

/** The flags of the countries a story is about, in a row under its heading. */
export default function BriefingFlags({ countries }: { countries: Country[] }) {
  return (
    <p className={styles.flags}>
      {countries.map((country) => (
        <Image
          key={country.code}
          src={`/images/briefings/flags/${country.code}.png`}
          alt={country.name}
          title={country.name}
          width={21}
          height={17}
          className={styles.flag}
        />
      ))}
    </p>
  );
}
