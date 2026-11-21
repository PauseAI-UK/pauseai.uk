import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./BriefingFigure.module.css";

/**
 * A drawing in a briefing's box, such as a diagram, with the marks citing
 * its sources under it at the right. Across the box, its words are part of
 * a wide drawing, so on a phone it keeps a width they can be read at, and
 * scrolls sideways. With `beside`, it's a narrow drawing in a column beside
 * the text (BriefingColumns' "figure"), which a phone's width can show
 * whole.
 */
export default function BriefingFigure({
  src,
  alt,
  width,
  height,
  cite,
  beside = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** The sources' footnote marks. */
  cite: ReactNode;
  beside?: boolean;
}) {
  const image = (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={beside ? "(max-width: 820px) 100vw, 400px" : "(max-width: 820px) 720px, 900px"}
      className={beside ? styles.besidePicture : styles.picture}
    />
  );
  return (
    <figure className={styles.figure}>
      {beside ? (
        image
      ) : (
        // Focusable, so a keyboard can scroll it on a phone.
        <div className={styles.scroller} role="region" aria-label={alt} tabIndex={0}>
          {image}
        </div>
      )}
      <p className={styles.cite}>{cite}</p>
    </figure>
  );
}
