"use client";

import { useRef, type ReactNode } from "react";
import { Select, TextArea, TextInput } from "@/components/ui/Controls";
import Bubble from "@/components/ui/Bubble";
import { buttonClass } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import Tag from "@/components/ui/Tag";
import { Muted } from "@/components/ui/Text";
import type { FormResult } from "@/lib/form-result";
import { formatCoverageDate, MEDIA, type Medium } from "@/lib/press/coverage";
import { whyNotRead } from "@/lib/press/finds";
import type { Tier } from "@/lib/press/sources";
import type { Find, PressPage, RemovedPiece, ShownPiece } from "@/lib/press/finds.server";
import type { FindOrg } from "@/lib/press/review";
import ExternalLink from "../ui/ExternalLink";
import Grid, { Column } from "../ui/Grid";
import { Refusal, ResultForm } from "../ui/ResultForm";
import { pressPageCopy as copy } from "./copy";
import styles from "./PressFinds.module.css";

type Act<Reason extends string = "gone"> = (form: FormData) => Promise<FormResult<Reason>>;

export type PressActions = {
  add: Act;
  turnDown: Act;
  restore: Act;
  edit: Act<"gone" | "blank" | "noOutlet">;
  editFind: Act<"gone" | "blank" | "noOutlet">;
  remove: Act;
};

/** What a piece's form fills its fields with. */
type Fields = Pick<ShownPiece, "title" | "outlet" | "medium" | "date" | "note">;

/**
 * A piece's fields: its headline, outlet (any outlet, or a new one's name),
 * kind, date and note, filled with `piece`'s; with its address first when
 * it's a new piece.
 */
function PieceFields({ piece }: { piece?: Fields }) {
  return (
    <>
      {!piece && (
        <label>
          {copy.shown.fields.url}
          <TextInput name="url" type="url" required />
        </label>
      )}
      <label>
        {copy.shown.fields.title}
        <TextInput name="title" defaultValue={piece?.title} required />
      </label>
      <label>
        {copy.shown.fields.outlet}
        <TextInput name="outlet" defaultValue={piece?.outlet} list="press-outlets" required />
      </label>
      <label>
        {copy.shown.fields.medium}
        <Select name="medium" defaultValue={piece?.medium ?? "Article"}>
          {MEDIA.map((medium) => (
            <option key={medium} value={medium}>
              {medium}
            </option>
          ))}
        </Select>
      </label>
      <label>
        {copy.shown.fields.date}
        <TextInput name="date" type="date" defaultValue={piece?.date ?? ""} />
      </label>
      <label>
        {copy.shown.fields.note}
        <TextArea name="note" defaultValue={piece?.note ?? ""} rows={6} />
      </label>
      <SubmitButton variant="primary" size="small">
        {copy.shown.save}
      </SubmitButton>
    </>
  );
}

/** Closes the bubble `form` is in, once what it sent is saved. */
const closeBubble = (form: { current: HTMLFormElement | null }) =>
  form.current!.closest<HTMLElement>("[popover]")!.hidePopover();

/** An Edit button that opens `piece`'s form in a bubble, to save with `act`. */
function EditBubble({
  id,
  piece,
  act,
}: {
  id: string;
  piece: Fields & { id: number };
  act: Act<"gone" | "blank" | "noOutlet">;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <Bubble
      id={id}
      trigger={buttonClass({ variant: "ghost", size: "small", fit: true })}
      label={copy.shown.edit}
      className={styles.editor}
    >
      <ResultForm ref={form} action={act} says={copy.refused} atTop={["gone"]} done={() => closeBubble(form)}>
        <input type="hidden" name="id" value={piece.id} />
        <PieceFields piece={piece} />
        <Refusal />
      </ResultForm>
    </Bubble>
  );
}

/** The button at the top of the page that opens a form for a piece staff found themselves, as Edit opens a piece's. */
export function AddPiece({ act }: { act: Act<"blank" | "noOutlet" | "notUrl" | "known"> }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <Bubble
      id="piece-add"
      trigger={buttonClass({ variant: "primary", size: "small", fit: true })}
      label={copy.shown.addPiece}
      className={styles.editor}
    >
      <ResultForm ref={form} action={act} says={copy.refused} done={() => closeBubble(form)}>
        <PieceFields />
        <Refusal />
      </ResultForm>
    </Bubble>
  );
}

/** One button for one find or piece, in a form of its own. */
function Button({ id, act, label, primary = false }: { id: number; act: Act; label: string; primary?: boolean }) {
  return (
    <ResultForm action={act} says={copy.refused} atTop={["gone"]}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant={primary ? "primary" : "ghost"} size="small">
        {label}
      </SubmitButton>
      <Refusal />
    </ResultForm>
  );
}

/** A heading with how many are under it. */
function Heading({ children, count }: { children: ReactNode; count: number }) {
  return (
    <h2 className={styles.heading}>
      {children} <Tag>{count}</Tag>
    </h2>
  );
}

/** Which PauseAI the LLM says a find is about, where it says it's ours. */
const ORG_NAMES: Partial<Record<FindOrg, string>> = { uk: "PauseAI UK", global: "PauseAI Global" };

/** What the LLM said of a find, as a tag: green for ours, amber for can't tell, plain for not judged or not read. */
function Verdict({ find }: { find: Find }) {
  if (find.verdict === "ours") {
    const org = find.org && ORG_NAMES[find.org];
    return <Tag tone="green">{org ? `${copy.waiting.verdicts.ours} · ${org}` : copy.waiting.verdicts.ours}</Tag>;
  }
  if (find.verdict === "unclear") return <Tag tone="amber">{copy.waiting.verdicts.unclear}</Tag>;
  if (find.verdict === "not ours") return <Tag>{copy.waiting.verdicts["not ours"]}</Tag>;
  return <Tag>{find.failure ? copy.waiting.notReadTag : copy.waiting.noVerdict}</Tag>;
}

/** What kind of news a find's or piece's source is, by its tier, or that it's unknown. */
function TierTag({ tier }: { tier: Tier | null }) {
  return <Tag>{tier === null ? copy.tiers.none : copy.tiers[tier]}</Tag>;
}

/** Where a piece's headline links: its address, or a cross-posted piece's first platform. */
const pieceHref = (piece: ShownPiece): string => piece.url ?? piece.links[0].url;

/** Where a find or piece is from, when, and what kind of piece it is. */
function byline(outlet: string | null, date: string | null, medium: Medium): string {
  return [outlet, date && formatCoverageDate(date), medium].filter(Boolean).join(" · ");
}

/** A find, as a card: the LLM's verdict, where and when, its headline, the passage that names us, and why. */
function FindCard({ find, children }: { find: Find; children: ReactNode }) {
  return (
    <li className={styles.card}>
      <div className={styles.top}>
        <div className={styles.meta}>
          <Verdict find={find} />
          <TierTag tier={find.tier} />
          <Muted>{byline(find.outlet, find.date, find.medium)}</Muted>
        </div>
        <div className={styles.buttons}>{children}</div>
      </div>
      <div className={styles.headline}>
        <ExternalLink href={find.url}>{find.title}</ExternalLink>
      </div>
      {find.passage && <blockquote className={styles.passage}>{find.passage}</blockquote>}
      {(find.note ?? find.reason) && <Muted>{find.note ?? find.reason}</Muted>}
      {find.failure && <Muted>{copy.waiting.notRead[whyNotRead(find.failure)]}</Muted>}
    </li>
  );
}

/** A piece on /press, as a row: when, where, what kind, its headline, and its buttons; Edit opens its form in a bubble under it. */
function PieceRow({ piece, actions }: { piece: ShownPiece; actions: PressActions }) {
  return (
    <li className={styles.piece}>
      <div>
        <div className={styles.pieceLine}>
          <span className={styles.date}>{formatCoverageDate(piece.date ?? undefined)}</span>
          <span className={styles.outlet}>{piece.outlet}</span>
          <span className={styles.kind}>{piece.medium}</span>
          <TierTag tier={piece.tier} />
        </div>
        <div className={styles.title}>
          <ExternalLink href={pieceHref(piece)}>{piece.title}</ExternalLink>
        </div>
      </div>
      <EditBubble id={`piece-edit-${piece.id}`} piece={piece} act={actions.edit} />
      <span className={styles.remove}>
        <Button id={piece.id} act={actions.remove} label={copy.shown.remove} />
      </span>
    </li>
  );
}

/** A piece removed from /press, as a card like a find's, to add again. */
function RemovedCard({ piece, children }: { piece: RemovedPiece; children: ReactNode }) {
  return (
    <li className={styles.card}>
      <div className={styles.top}>
        <div className={styles.meta}>
          <Muted>{byline(piece.outlet, piece.date, piece.medium)}</Muted>
        </div>
        <div className={styles.buttons}>{children}</div>
      </div>
      <div className={styles.headline}>
        <ExternalLink href={pieceHref(piece)}>{piece.title}</ExternalLink>
      </div>
      {piece.note && <Muted>{piece.note}</Muted>}
    </li>
  );
}

/**
 * The staff Press page's lists: the survey's finds waiting for staff, each
 * a card with the LLM's verdict and the passage that names us, to add to
 * /press or remove; the coverage on /press, a row each, to edit or remove;
 * and, folded away, what's not on /press, finds and pieces removed, newest
 * first, each to add to /press.
 */
export default function PressFinds({ page, actions }: { page: PressPage; actions: PressActions }) {
  const removedAll = [
    ...page.notOurs.map((find) => ({ find, at: find.decidedAt })),
    ...page.removed.map((piece) => ({ piece, at: piece.removedAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  return (
    <Grid>
      <datalist id="press-outlets">
        {page.outlets.map((outlet) => (
          <option key={outlet} value={outlet} />
        ))}
      </datalist>
      <Column span={4}>
        <div className={styles.page}>
          {page.waiting.length > 0 && (
            <section className={styles.section}>
              <Heading count={page.waiting.length}>{copy.waiting.title}</Heading>
              <ul className={styles.cards}>
                {page.waiting.map((find) => (
                  <FindCard key={find.id} find={find}>
                    <Button id={find.id} act={actions.add} label={copy.waiting.add} primary />
                    <EditBubble
                      id={`find-edit-${find.id}`}
                      piece={{ ...find, note: find.note ?? find.reason }}
                      act={actions.editFind}
                    />
                    <Button id={find.id} act={actions.turnDown} label={copy.shown.remove} />
                  </FindCard>
                ))}
              </ul>
            </section>
          )}
          <section className={styles.section}>
            <Heading count={page.shown.length}>{copy.shown.title}</Heading>
            <ul className={styles.pieces}>
              {page.shown.map((piece) => (
                <PieceRow key={piece.id} piece={piece} actions={actions} />
              ))}
            </ul>
          </section>
          {removedAll.length > 0 && (
            <details className={styles.removed}>
              <summary>
                <Heading count={removedAll.length}>{copy.removed.title}</Heading>
              </summary>
              <ul className={styles.cards}>
                {removedAll.map((item) =>
                  "find" in item ? (
                    <FindCard key={`find-${item.find.id}`} find={item.find}>
                      <Button id={item.find.id} act={actions.add} label={copy.waiting.add} />
                    </FindCard>
                  ) : (
                    <RemovedCard key={`piece-${item.piece.id}`} piece={item.piece}>
                      <Button id={item.piece.id} act={actions.restore} label={copy.waiting.add} />
                    </RemovedCard>
                  ),
                )}
              </ul>
            </details>
          )}
        </div>
      </Column>
    </Grid>
  );
}
