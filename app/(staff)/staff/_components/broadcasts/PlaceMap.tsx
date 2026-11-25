"use client";

import { createContext, useContext } from "react";
import type { TextPlace } from "@/lib/broadcasts/text-parts";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { tilesAround } from "@/lib/broadcasts/map-tiles";
import styles from "./PlaceMap.module.css";

/** Whether a place's map is OpenStreetMap's, or a drawing (BroadcastWriterData.realMaps); a drawing unless a writer says. */
export const RealMaps = createContext(false);

/** Where a place is on Google Maps, its pin on it, to check it's the right spot, as most phones open it there. */
export const mapOf = (place: TextPlace) => `https://www.google.com/maps?q=${place.latitude},${place.longitude}`;

/** OpenStreetMap's map of the streets round a place, still, as WhatsApp's is, with its credit, which its licence asks. */
function StreetMap({ place }: { place: TextPlace }) {
  const around = tilesAround(place.latitude, place.longitude);
  return (
    <>
      <div className={styles.tiles} style={{ marginLeft: around.left, marginTop: around.top }}>
        {around.tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element -- a square of map from the site's own route, which next/image would only fetch again
          <img
            key={`${tile.x}/${tile.y}`}
            className={styles.tile}
            src={`/staff/map-tiles/${around.zoom}/${tile.x}/${tile.y}`}
            alt=""
            style={{ left: tile.left, top: tile.top }}
          />
        ))}
      </div>
      <span className={styles.credit}>© OpenStreetMap</span>
    </>
  );
}

/** A map's pin, its point at the middle of the map. */
function Pin() {
  return (
    <svg viewBox="0 0 16 24" aria-hidden="true" className={styles.pin}>
      <path d="M8 24C3 15 0 12 0 8a8 8 0 0 1 16 0c0 4-3 7-8 16Z" />
      <circle cx="8" cy="8" r="3" className={styles.pinHole} />
    </svg>
  );
}

/**
 * A place's map, as a text's header shows it: OpenStreetMap's streets round
 * it, where RealMaps says, or else a drawing of some, with a pin at its
 * middle. Over it, a link to Google Maps at its pin, as most phones open a
 * place there.
 */
export default function PlaceMap({ place }: { place: TextPlace }) {
  const real = useContext(RealMaps);
  const words = broadcastsCopy.broadcastPages.placeChooser;
  return (
    <div className={styles.map}>
      {real ? (
        <StreetMap place={place} />
      ) : (
        <svg viewBox="0 0 220 90" aria-hidden="true" className={styles.drawing}>
          <rect width="220" height="90" className={styles.ground} />
          <path d="M-5 34 L225 28 M104 -5 L98 95 M0 66 L220 72" className={styles.road} />
        </svg>
      )}
      <Pin />
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
