"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented, TextInput } from "@/components/ui/Controls";
import { Field, Hint } from "@/components/ui/Field";
import { Muted } from "@/components/ui/Text";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import type { TextHeader, TextPlace } from "@/lib/broadcasts/text-parts";
import DropArea from "../ui/DropArea";
import ExternalLink from "../ui/ExternalLink";
import styles from "./TextTop.module.css";

const copy = broadcastsCopy.broadcastPages;

/** Finds the places a Google Maps link or words point at (findPlaces, lib/broadcasts/places.server.ts). */
export type FindPlaces = (input: string) => Promise<TextPlace[]>;

/** Keeps a picture for a text's top: its ID, or why it can't be one (uploadTextPicture); nothing from a page gone out of date. */
export type UploadPicture = (
  file: File,
) => Promise<{ pictureId: string } | { refused: "not-picture" | "too-big" } | undefined>;

/** Where a picture kept for a text is served, for the writer to show it. */
export const pictureSource = (id: string) => `/api/text-pictures/${id}`;

/** Where a place is on OpenStreetMap's map, its pin on it, to check it's the right spot. */
const mapOf = (place: TextPlace) =>
  `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=17/${place.latitude}/${place.longitude}`;

/**
 * The place a text's map shows: first, a box for a Google Maps link or
 * words to search for, then the places found, to choose one. Once one is
 * chosen, its name and address, which WhatsApp shows under the map, to
 * change so they say where exactly, and a link to check its pin on a map.
 * A place can change after approval, as each send gives it.
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
        <Button variant="primary" size="small" fit disabled={disabled || !input.trim()} pending={finding} onClick={find}>
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
          <Hint>{words.underMap}</Hint>
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
          <span className={styles.check}>
            <ExternalLink href={mapOf(place)}>{words.checkMap}</ExternalLink>
          </span>
          <Hint>{words.changeable}</Hint>
        </>
      )}
    </div>
  );
}

/**
 * The picture at a text's top: once there is one, the picture, small; and
 * a box to drop one on, or choose one, in its place. One pasted anywhere in
 * the writer's Write card comes here too (BroadcastWriter). A picture can
 * change after approval, as each send gives it.
 */
function PictureChooser({
  pictureId,
  onChange,
  uploadPicture,
  disabled,
}: {
  pictureId: string | null;
  onChange: (pictureId: string) => void;
  uploadPicture: UploadPicture;
  disabled: boolean;
}) {
  const words = copy.pictureChooser;
  const [uploading, setUploading] = useState(false);
  const [refusal, setRefusal] = useState<"not-picture" | "too-big" | null>(null);
  const upload = async ([file]: File[]) => {
    if (!file || disabled) return;
    setUploading(true);
    setRefusal(null);
    const kept = await uploadPicture(file);
    setUploading(false);
    // None from a page gone out of date, which says so over the draft.
    if (!kept) return;
    if ("refused" in kept) return setRefusal(kept.refused);
    onChange(kept.pictureId);
  };
  return (
    <div className={styles.picture}>
      {pictureId && <img className={styles.shown} src={pictureSource(pictureId)} alt={words.shown} />}
      <DropArea
        hint={pictureId ? words.dropAnother : words.drop}
        choose={words.choose}
        accept="image/jpeg,image/png"
        pending={uploading}
        onFiles={(files) => void upload(files)}
      />
      {refusal && <p className={styles.refusal}>{words.refusals[refusal]}</p>}
      {pictureId && <Hint>{words.changeable}</Hint>}
    </div>
  );
}

/**
 * A text's top, over its words: the card WhatsApp makes of the words' first
 * link, a picture (PictureChooser), or a map of a place (PlaceChooser). The
 * kind is the template's, so only new words can change it (`fixed`
 * otherwise); its picture or place can change whenever.
 */
export default function TextTop({
  header,
  place,
  pictureId,
  onChange,
  findPlaces,
  uploadPicture,
  fixed = false,
  disabled = false,
}: {
  header: TextHeader | null;
  place: TextPlace | null;
  pictureId: string | null;
  onChange: (top: { header?: TextHeader | null; place?: TextPlace | null; pictureId?: string | null }) => void;
  findPlaces: FindPlaces;
  uploadPicture: UploadPicture;
  fixed?: boolean;
  disabled?: boolean;
}) {
  const words = copy.textTop;
  return (
    <div className={styles.top}>
      <p className={styles.label}>{words.label}</p>
      <Segmented<"link" | TextHeader>
        label={words.label}
        options={[
          { value: "link", label: words.linkPreview },
          { value: "image", label: words.picture },
          { value: "location", label: words.place },
        ]}
        value={header ?? "link"}
        disabled={fixed || disabled}
        onChange={(value) => onChange({ header: value === "link" ? null : value })}
      />
      {header === "location" && (
        <PlaceChooser
          place={place}
          onChange={(chosen) => onChange({ place: chosen })}
          findPlaces={findPlaces}
          disabled={disabled}
        />
      )}
      {header === "image" && (
        <PictureChooser
          pictureId={pictureId}
          onChange={(chosen) => onChange({ pictureId: chosen })}
          uploadPicture={uploadPicture}
          disabled={disabled}
        />
      )}
      {header === null && <Hint>{words.linkPreviewNote}</Hint>}
    </div>
  );
}
