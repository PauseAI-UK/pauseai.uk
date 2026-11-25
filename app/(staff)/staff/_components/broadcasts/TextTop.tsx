"use client";

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import IconButton, { CrossIcon } from "@/components/ui/IconButton";
import { Segmented, TextInput } from "@/components/ui/Controls";
import { Hint } from "@/components/ui/Field";
import { Muted } from "@/components/ui/Text";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import type { TextHeader, TextPlace } from "@/lib/broadcasts/text-parts";
import DropArea from "../ui/DropArea";
import Choices from "../ui/Choices";
import { menuWiderClass } from "../ui/Menu";
import { menuRow } from "../ui/MenuSelect";
import PlaceMap from "./PlaceMap";
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

/**
 * A place's name or address under its map: words on one line that wrap, as
 * WhatsApp's do, in a box that grows a line at a time to show them all,
 * with no new line of their own (Enter makes none, and a pasted one is a
 * space).
 */
function PlaceWords({
  className,
  label,
  value,
  disabled,
  onChange,
}: {
  className: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const words = box.current!;
    words.style.height = "auto";
    words.style.height = `${words.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={box}
      className={className}
      aria-label={label}
      rows={1}
      value={value}
      disabled={disabled}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      onChange={(event) => onChange(event.target.value.replace(/\s*\n\s*/g, " "))}
    />
  );
}

/**
 * The place a text's map shows: till one is chosen, a box for a Google Maps
 * link or words to search for, then the places found, to choose one, in a
 * menu's box that hangs under it, each its name and address, as the
 * template menu's choices are (MenuSelect), and closes as a menu does. Once
 * one is chosen, the place as WhatsApp shows it, a map with its name and
 * address under it, and a × beside it, as a picture has, that takes it off
 * for the box again. The map opens Google Maps at its pin, to check it's the
 * right spot; the name and address are boxes that look like words, and wrap
 * as they do (PlaceWords), to change so they say where exactly. A place can change after approval, as
 * each send gives it.
 */
function PlaceChooser({
  place,
  onChange,
  findPlaces,
  disabled,
}: {
  place: TextPlace | null;
  onChange: (place: TextPlace | null) => void;
  findPlaces: FindPlaces;
  disabled: boolean;
}) {
  const words = copy.placeChooser;
  const anchor = `--places-${useId().replace(/:/g, "")}`;
  const menu = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [found, setFound] = useState<TextPlace[] | null>(null);
  const [finding, setFinding] = useState(false);
  const choose = (chosen: TextPlace) => {
    onChange(chosen);
    setFound(null);
    setInput("");
  };
  // The places found open their menu once they're on the page.
  useLayoutEffect(() => {
    if (found?.length) menu.current!.showPopover();
  }, [found]);
  const find = async () => {
    setFinding(true);
    const places = await findPlaces(input.trim());
    setFinding(false);
    // One place, as a link gives, is chosen at once; more are offered.
    if (places.length === 1) choose(places[0]);
    else setFound(places);
  };
  if (place) {
    return (
      <div className={styles.shownBox}>
        <div className={styles.placeCard}>
          <PlaceMap place={place} />
          <PlaceWords
            className={styles.placeName}
            label={words.name}
            value={place.name}
            disabled={disabled}
            onChange={(name) => onChange({ ...place, name })}
          />
          <PlaceWords
            className={styles.placeAddress}
            label={words.address}
            value={place.address}
            disabled={disabled}
            onChange={(address) => onChange({ ...place, address })}
          />
        </div>
        {!disabled && (
          <IconButton
            look="outline"
            size={22}
            className={styles.remove}
            aria-label={words.remove}
            title={words.remove}
            onClick={() => onChange(null)}
          >
            <CrossIcon size={12} />
          </IconButton>
        )}
      </div>
    );
  }
  return (
    <div className={styles.form}>
      <div className={styles.findRow}>
        <TextInput
          aria-label={words.find}
          placeholder={words.find}
          style={{ anchorName: anchor } as CSSProperties}
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
      {found && found.length === 0 && <Muted>{words.none}</Muted>}
      {found && found.length > 0 && (
        <div
          ref={menu}
          popover="auto"
          className={menuWiderClass}
          style={{ positionAnchor: anchor } as CSSProperties}
          onToggle={(event) => {
            if (event.newState === "closed") setFound(null);
          }}
        >
          <Choices
            options={found.map((one, i) => ({ value: String(i), label: one.name }))}
            current={[]}
            row={(option) => {
              const one = found[Number(option.value)];
              return (
                <button type="button" className={menuRow.row} onClick={() => choose(one)}>
                  <span className={menuRow.head}>
                    <span className={menuRow.name}>{one.name}</span>
                  </span>
                  <span className={menuRow.facts}>{one.address}</span>
                </button>
              );
            }}
          />
        </div>
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
              <CrossIcon size={12} />
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
