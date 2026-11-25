"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
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

/**
 * Where a picture kept for a text is served, for the writer to show it; an
 * example's, given whole as a data: address, is its own (BroadcastWriter.examples.ts).
 */
export const pictureSource = (id: string) => (id.startsWith("data:") ? id : `/api/text-pictures/${id}`);

/** Where a place is on Google Maps, its pin on it, to check it's the right spot, as most phones open it there. */
const mapOf = (place: TextPlace) => `https://www.google.com/maps?q=${place.latitude},${place.longitude}`;

/**
 * The place a text's map shows: till one is chosen, a box for a Google Maps
 * link or words to search for, then the places found, to choose one. Once
 * one is chosen, its name and address, which WhatsApp shows under the map,
 * to change so they say where exactly; a link to check its pin on a map;
 * and Find another, for the box again. A place can change after approval,
 * as each send gives it.
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
  const [searching, setSearching] = useState(!place);
  const [input, setInput] = useState("");
  const [found, setFound] = useState<TextPlace[] | null>(null);
  const [finding, setFinding] = useState(false);
  const choose = (chosen: TextPlace) => {
    onChange(chosen);
    setFound(null);
    setInput("");
    setSearching(false);
  };
  const find = async () => {
    setFinding(true);
    const places = await findPlaces(input.trim());
    setFinding(false);
    // One place, as a link gives, is chosen at once; more are offered.
    if (places.length === 1) choose(places[0]);
    else setFound(places);
  };
  return (
    <div className={styles.form}>
      {searching && (
        <div className={styles.findRow}>
          <TextInput
            aria-label={words.find}
            placeholder={words.find}
            value={input}
            disabled={disabled}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !input.trim()) return;
              event.preventDefault();
              void find();
            }}
          />
          <Button variant="primary" size="small" fit disabled={disabled || !input.trim()} pending={finding} onClick={find}>
            {words.findButton}
          </Button>
        </div>
      )}
      {found && found.length === 0 && <Muted>{words.none}</Muted>}
      {found && found.length > 0 && (
        <ul className={styles.found} aria-label={words.found}>
          {found.map((one) => (
            <li key={`${one.latitude},${one.longitude},${one.name}`}>
              <button type="button" onClick={() => choose(one)}>
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
          <div className={styles.placeLinks}>
            <ExternalLink href={mapOf(place)}>{words.checkMap}</ExternalLink>
            {!searching && !disabled && (
              <Button variant="ghost" size="small" fit onClick={() => setSearching(true)}>
                {words.findAnother}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The picture at a text's top: a box to drop one on, or choose one; once
 * there is one, the picture, small, with a × in its corner that takes it
 * off, for the box again. One pasted anywhere in the writer's Write card
 * comes here too, in place of any there (BroadcastWriter). A picture can
 * change after approval, as each send gives it.
 */
function PictureChooser({
  pictureId,
  onChange,
  uploadPicture,
  disabled,
}: {
  pictureId: string | null;
  onChange: (pictureId: string | null) => void;
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
    const kept = await uploadPicture(file).finally(() => setUploading(false));
    // None from a page gone out of date, which says so over the draft.
    if (!kept) return;
    if ("refused" in kept) return setRefusal(kept.refused);
    onChange(kept.pictureId);
  };
  return (
    <div className={styles.form}>
      {pictureId ? (
        <div className={styles.shownBox}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a staff upload, or an example's data: address, shown as sent */}
          <img className={styles.shown} src={pictureSource(pictureId)} alt={words.shown} />
          {!disabled && (
            <IconButton
              look="outline"
              size={22}
              className={styles.remove}
              aria-label={words.remove}
              title={words.remove}
              onClick={() => onChange(null)}
            >
              ×
            </IconButton>
          )}
        </div>
      ) : (
        <DropArea
          hint={words.drop}
          choose={words.choose}
          accept="image/jpeg,image/png"
          pending={uploading}
          onFiles={(files) => void upload(files)}
        />
      )}
      {refusal && <p className={styles.refusal}>{words.refusals[refusal]}</p>}
      {pictureId && <Hint>{words.changeable}</Hint>}
    </div>
  );
}

/**
 * A text's top, over its words: the card WhatsApp makes of the words' first
 * link, `link`, which is None till they have one; a picture
 * (PictureChooser); or a map of a place (PlaceChooser). The
 * kind is the template's, so only new words can change it (`fixed`
 * otherwise); its picture or place can change whenever.
 */
export default function TextTop({
  header,
  place,
  pictureId,
  link,
  onChange,
  findPlaces,
  uploadPicture,
  fixed = false,
  disabled = false,
}: {
  header: TextHeader | null;
  place: TextPlace | null;
  pictureId: string | null;
  link: string | undefined;
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
          { value: "link", label: link ? words.linkPreview : words.none },
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
    </div>
  );
}
