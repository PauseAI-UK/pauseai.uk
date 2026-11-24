"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented, TextInput } from "@/components/ui/Controls";
import { Field, Hint } from "@/components/ui/Field";
import { Muted } from "@/components/ui/Text";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import type { TextHeader, TextPlace } from "@/lib/broadcasts/text-parts";
import styles from "./TextTop.module.css";

const copy = broadcastsCopy.broadcastPages;

/** Finds the places a Google Maps link or words point at (findPlaces, lib/broadcasts/places.server.ts). */
export type FindPlaces = (input: string) => Promise<TextPlace[]>;

/** Where a place is on OpenStreetMap's map, its pin on it, to check it's the right spot. */
const mapOf = (place: TextPlace) =>
  `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=17/${place.latitude}/${place.longitude}`;

/**
 * The place a text's map shows: a box for a Google Maps link or words to
 * search for, then the places found, to choose one; once chosen, its name
 * and address, as WhatsApp shows them under the map, to change, and a link
 * to check its pin on a map. A place can change after approval, as each
 * send gives it.
 */
function PlaceChooser({
  place,
  onChange,
  findPlaces,
  disabled,
}: {
  place: TextPlace | null;
  onChange: (place: TextPlace) => void;
  findPlaces: FindPlaces;
  disabled: boolean;
}) {
  const words = copy.placeChooser;
  const [input, setInput] = useState("");
  const [found, setFound] = useState<TextPlace[] | null>(null);
  const [finding, setFinding] = useState(false);
  const find = async () => {
    setFinding(true);
    const places = await findPlaces(input.trim());
    setFinding(false);
    // One place, as a link gives, is chosen at once; more are offered.
    if (places.length === 1) {
      onChange(places[0]);
      setFound(null);
    } else setFound(places);
  };
  return (
    <div className={styles.place}>
      <div className={styles.findRow}>
        <Field label={words.find}>
          <TextInput
            value={input}
            disabled={disabled}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !input.trim()) return;
              event.preventDefault();
              void find();
            }}
          />
        </Field>
        <Button variant="ghost" fit disabled={disabled || !input.trim()} pending={finding} onClick={find}>
          {words.findButton}
        </Button>
      </div>
      {found && found.length === 0 && <Muted>{words.none}</Muted>}
      {found && found.length > 0 && (
        <ul className={styles.found} aria-label={words.found}>
          {found.map((one) => (
            <li key={`${one.latitude},${one.longitude},${one.name}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(one);
                  setFound(null);
                }}
              >
                <strong>{one.name}</strong> <span>{one.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {place && (
        <>
          <div className={styles.names}>
            <Field label={words.name}>
              <TextInput
                value={place.name}
                disabled={disabled}
                onChange={(event) => onChange({ ...place, name: event.target.value })}
              />
            </Field>
            <Field label={words.address}>
              <TextInput
                value={place.address}
                disabled={disabled}
                onChange={(event) => onChange({ ...place, address: event.target.value })}
              />
            </Field>
          </div>
          <a className={styles.check} href={mapOf(place)} target="_blank" rel="noreferrer">
            {words.checkMap}
          </a>
        </>
      )}
      <Hint>{words.changeable}</Hint>
    </div>
  );
}

/**
 * A text's top, over its words: the card WhatsApp makes of the words' first
 * link, or a map of a place (PlaceChooser). The kind is the template's, so
 * only new words can change it (`fixed` otherwise); its place can change
 * whenever.
 */
export default function TextTop({
  header,
  place,
  onChange,
  findPlaces,
  fixed = false,
  disabled = false,
}: {
  header: TextHeader | null;
  place: TextPlace | null;
  onChange: (top: { header?: TextHeader | null; place?: TextPlace | null }) => void;
  findPlaces: FindPlaces;
  fixed?: boolean;
  disabled?: boolean;
}) {
  const words = copy.textTop;
  return (
    <div className={styles.top}>
      <p className={styles.label}>{words.label}</p>
      <Segmented<"link" | "location">
        label={words.label}
        options={[
          { value: "link", label: words.linkPreview },
          { value: "location", label: words.place },
        ]}
        value={header ?? "link"}
        disabled={fixed || disabled}
        onChange={(value) => onChange({ header: value === "link" ? null : value })}
      />
      {header === "location" ? (
        <PlaceChooser
          place={place}
          onChange={(chosen) => onChange({ place: chosen })}
          findPlaces={findPlaces}
          disabled={disabled}
        />
      ) : (
        <Hint>{words.linkPreviewNote}</Hint>
      )}
    </div>
  );
}
