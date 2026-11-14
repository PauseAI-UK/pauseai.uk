"use client";

import { useMemo, useState, type DragEvent } from "react";
import { FileInput, Select, TextInput } from "@/components/ui/Controls";
import DatePicker from "@/components/ui/DatePicker";
import { Field, FieldSet } from "@/components/ui/Field";
import LinkButton from "@/components/ui/LinkButton";
import Required from "@/components/ui/Required";
import Table from "@/components/ui/Table";
import Tag from "@/components/ui/Tag";
import type { SignupEventChoice } from "@/lib/supporters/signup-uploads";
import {
  MAX_SIGNUP_FILE_BYTES,
  readSignupFile,
  signupEventColumns,
  signupFileText,
  type SignupFileRead,
  type SignupUploadInput,
} from "@/lib/supporters/signup-csv";
import { staffDate } from "@/lib/staff-time";
import SignupUploadHelp, { SignupColumnNames } from "./SignupUploadHelp";
import SignupUploadPreview, { type SignupUploadActions } from "./SignupUploadPreview";
import Choices from "../ui/Choices";
import ExternalLink from "../ui/ExternalLink";
import Grid, { Card } from "../ui/Grid";
import Numbered from "../ui/Numbered";
import Strip from "../ui/Strip";
import styles from "./SignupUpload.module.css";
import { supportersCopy } from "./copy";

const copy = supportersCopy.signupUpload;

/** Files a spreadsheet saves that aren't text, which would otherwise read as nonsense. */
const NOT_CSV = /\.(xlsx?|ods|numbers|pdf)$/i;

/** Why a file can't be read, in words. */
function refusedWords(read: Exclude<SignupFileRead, { ok: true }>): string {
  if (read.reason === "empty") return copy.refused.empty;
  if (read.reason === "clash") {
    return copy.refused.clash(copy.help.fields[read.field].label, read.headings.join(", "));
  }
  return copy.refused.missing(
    read.missing.map((field) => copy.help.fields[field].label).join(", "),
    read.headings.join(", "),
  );
}

type Chosen = { name: string; text: string; read: SignupFileRead };

/**
 * Uploading sign-ups, in four numbered steps always shown: the file, beside
 * what it should look like, and once read, what each of its columns will do;
 * the date and note; an event; and what importing will do, worked out as soon
 * as there's enough to go on, with the button that does it. The file is read
 * in the browser, and sent to the server only to preview and import it.
 */
export default function SignupUploadForm({
  events,
  today,
  actions,
}: {
  events: SignupEventChoice[];
  today: string;
  actions: SignupUploadActions;
}) {
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [eventId, setEventId] = useState("");
  const [column, setColumn] = useState("");
  const [signedOn, setSignedOn] = useState(today);
  const [note, setNote] = useState("");
  const [allNames, setAllNames] = useState(false);

  async function choose(file: File) {
    setChosen(null);
    setColumn("");
    if (NOT_CSV.test(file.name)) return setFileError(copy.drop.notCsv(file.name));
    if (file.size > MAX_SIGNUP_FILE_BYTES) return setFileError(copy.drop.tooBig);
    const text = signupFileText(await file.arrayBuffer());
    setFileError(null);
    setChosen({ name: file.name, text, read: readSignupFile(text) });
  }

  function startAgain() {
    setChosen(null);
    setColumn("");
    setFileError(null);
  }

  function dropped(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const [file] = event.dataTransfer.files;
    if (file) void choose(file);
  }

  const read = chosen?.read.ok ? chosen.read : null;
  const choices = read ? signupEventColumns(read) : [];
  const chosenEvent = events.find((event) => event.id === eventId);
  // A column chosen, and then an event, are the upload's event sign-up; either alone is none.
  const eventColumn = column && eventId ? column : "";
  // What stops the import, though not the preview: each a line under the button.
  const blockers = [
    ...(read ? [] : [copy.preview.blockers.file]),
    ...(note.trim() ? [] : [copy.preview.blockers.note]),
    ...(column && !eventId ? [copy.preview.blockers.event] : []),
  ];
  // What the preview is sent, as text, so it's the same object, and the preview isn't worked out again, until something in it changes.
  const sent = !read
    ? null
    : JSON.stringify({
        csv: chosen!.text,
        filename: chosen!.name,
        eventId: eventColumn ? eventId : null,
        eventColumn: eventColumn || null,
        signedOn,
        note,
      } satisfies SignupUploadInput);
  const input = useMemo(() => (sent === null ? null : (JSON.parse(sent) as SignupUploadInput)), [sent]);

  // Even, so the file's card and what it needs are as tall as each other; every other card has a row to itself.
  return (
    <Grid even>
      <Card span={6} title={<Numbered n={1}>{copy.form.formsTitle}</Numbered>} id="upload-forms">
        <div className={styles.fields}>
          <Field label={<Required>{copy.form.signedOn}</Required>}>
            <DatePicker value={signedOn} onChange={setSignedOn} />
          </Field>
          <Field label={<Required>{copy.form.note}</Required>}>
            <TextInput
              value={note}
              required
              placeholder={copy.form.noteHint}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
      </Card>
      <Card
        span={3}
        title={<Numbered n={2}>{read ? chosen!.name : copy.steps.file}</Numbered>}
        id="upload-file"
        action={read && <LinkButton onClick={startAgain}>{copy.drop.another}</LinkButton>}
      >
        {read ? (
          <>
            <p>{copy.drop.read(read.rows.length, read.columns.length)}</p>
            <Table>
              <thead>
                <tr>
                  <th>{copy.columns.heading}</th>
                  <th>{copy.columns.goes}</th>
                  <th>{copy.columns.filled}</th>
                </tr>
              </thead>
              <tbody>
                {read.columns.map((c) => (
                  <tr key={c.index}>
                    <td>{c.heading}</td>
                    <td>
                      {c.heading === column ? (
                        <Tag tone="blue">{copy.columns.event}</Tag>
                      ) : c.field ? (
                        <Tag tone="green">{copy.help.fields[c.field].label}</Tag>
                      ) : (
                        <Tag tone="amber">{copy.columns.ignored}</Tag>
                      )}
                    </td>
                    <td>{c.filled}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        ) : (
          <>
            <label
              className={dragging ? `${styles.drop} ${styles.dragging}` : styles.drop}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={dropped}
            >
              <strong>{copy.drop.title}</strong>
              <span>{copy.drop.or}</span>
              <FileInput
                aria-label={copy.drop.label}
                accept=".csv,.tsv,.txt,text/csv"
                onChange={(event) => {
                  const [file] = event.target.files!;
                  if (file) void choose(file);
                  event.target.value = "";
                }}
              />
            </label>
            {fileError && <Strip tone="red">{fileError}</Strip>}
            {chosen && !chosen.read.ok && <Strip tone="red">{refusedWords(chosen.read)}</Strip>}
          </>
        )}
      </Card>
      <Card span={3} look="aside" title={copy.help.title} id="upload-help">
        <SignupUploadHelp open={allNames} onToggle={() => setAllNames(!allNames)} />
      </Card>
      {allNames && (
        <Card span={6} look="aside" title={copy.help.more} id="upload-names">
          <SignupColumnNames />
        </Card>
      )}

      <Card span={6} title={<Numbered n={3}>{copy.form.eventTitle}</Numbered>} id="upload-event">
        <div className={styles.fields}>
          <Field label={copy.form.eventColumn}>
            <Select value={column} disabled={choices.length === 0} onChange={(event) => setColumn(event.target.value)}>
              <option value="">{copy.form.noColumn}</option>
              {choices.map((heading) => (
                <option key={heading} value={heading}>
                  {heading}
                </option>
              ))}
            </Select>
          </Field>
          {read && choices.length === 0 && <Strip tone="amber">{copy.form.noEventColumn}</Strip>}
          {/* The event, greyed out until there's a column saying who's going to it. */}
          <FieldSet label={copy.form.event} disabled={!column}>
            {chosenEvent ? (
              <p className={styles.chosen}>
                <span>
                  <strong>
                    <ExternalLink href={chosenEvent.url}>{chosenEvent.name}</ExternalLink>
                  </strong>{" "}
                  {staffDate(chosenEvent.startAt)}
                </span>
                <LinkButton onClick={() => setEventId("")}>{copy.form.removeEvent}</LinkButton>
              </p>
            ) : (
              <div>
                <Choices
                  search={copy.form.findEvent}
                  current={[]}
                  options={events.map((event) => ({
                    value: event.id,
                    label: event.name,
                    detail: staffDate(event.startAt),
                  }))}
                  row={(option) => (
                    <button type="button" className={styles.choice} onClick={() => setEventId(option.value)}>
                      {option.label} <span>{option.detail}</span>
                    </button>
                  )}
                />
              </div>
            )}
          </FieldSet>
        </div>
      </Card>

      <SignupUploadPreview input={input} blockers={blockers} {...actions} />
    </Grid>
  );
}
