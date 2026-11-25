"use client";

import { createContext, useContext } from "react";
import type { TextPlace } from "@/lib/broadcasts/text-parts";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import styles from "./PlaceMap.module.css";

/** Whether a place's map is Google's, or a drawing (BroadcastWriterData.realMaps); a drawing unless a writer says. */
export const RealMaps = createContext(false);

/** Where a place is on Google Maps, its pin on it, to check it's the right spot, as most phones open it there. */
export const mapOf = (place: TextPlace) => `https://www.google.com/maps?q=${place.latitude},${place.longitude}`;

/**
 * A place's map, as a text's header shows it: Google's, where RealMaps
 * says, or else a drawing of one with a pin in its middle. Over it, a link
 * to Google Maps at its pin, which keeps the map from being dragged or
 * zoomed, as WhatsApp's is a picture.
 */
export default function PlaceMap({ place }: { place: TextPlace }) {
  const real = useContext(RealMaps);
  const words = broadcastsCopy.broadcastPages.placeChooser;
  return (
    <div className={styles.map}>
      {real ? (
        <iframe
          className={styles.frame}
          src={`https://maps.google.com/maps?q=${place.latitude},${place.longitude}&z=16&output=embed`}
          title={place.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          tabIndex={-1}
        />
      ) : (
        <svg viewBox="0 0 220 90" aria-hidden="true" className={styles.drawing}>
          <rect width="220" height="90" className={styles.ground} />
          <path d="M-5 34 L225 28 M104 -5 L98 95 M0 66 L220 72" className={styles.road} />
          <path d="M110 46 C102 34 102 22 110 22 C118 22 118 34 110 46Z" className={styles.pin} />
        </svg>
      )}
      <a
        className={styles.cover}
        href={mapOf(place)}
        target="_blank"
        rel="noreferrer"
        aria-label={words.checkMap}
        title={words.checkMap}
      />
    </div>
  );
}
