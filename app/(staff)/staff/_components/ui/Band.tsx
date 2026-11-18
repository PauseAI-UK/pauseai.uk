import type { ReactNode } from "react";
import styles from "./Band.module.css";

/**
 * One fact in a Band: its label, its value, and a quiet line under it of
 * where it's from or what it adds. Nothing when there's no value.
 */
export function BandFact({
  label,
  detail,
  tall,
  foot,
  children,
}: {
  label: string;
  detail?: ReactNode;
  /** Taller than the rest, such as pills: where the facts are short of room, a column of its own. */
  tall?: boolean;
  /** Its value at its foot, such as lozenges with no line under them: their bottom level with the bottom of the words of the facts beside it. */
  foot?: boolean;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <div className={tall ? styles.tall : foot ? styles.foot : undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
      {detail && <dd className={styles.detail}>{detail}</dd>}
    </div>
  );
}

/** Facts (BandFact) laid out as a Band lays out its own, anywhere else on a page. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className={`${styles.facts} ${styles.alone}`}>{children}</dl>;
}

/**
 * The tinted band at the top of a record's page (a supporter's, a
 * mailing's): `lead` at its left, such as a map; the title, with a tag
 * beside it, and under it in grey `subtitle`, such as what a politician
 * is; `corner` quietly at its top right, such as where a record came from; under them the facts (BandFact), with `aside`
 * at their bottom right, such as Counts, or under them at the right where there isn't room beside them.
 */
export default function Band({
  title,
  subtitle,
  corner,
  tag,
  lead,
  aside,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  corner?: ReactNode;
  tag?: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
  /** For its place on the page: the space under it. */
  className?: string;
  /** The facts, each a BandFact. */
  children: ReactNode;
}) {
  return (
    <div className={className ? `${styles.band} ${className}` : styles.band}>
      {lead}
      <div className={styles.main}>
        <div className={styles.heading}>
          <h1>{title}</h1>
          {tag}
          {corner && <div className={styles.corner}>{corner}</div>}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        <div className={styles.row}>
          <div className={styles.factsBox}>
            <dl className={styles.facts}>{children}</dl>
          </div>
          {aside && <div className={styles.aside}>{aside}</div>}
        </div>
      </div>
    </div>
  );
}
