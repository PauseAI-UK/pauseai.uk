"use client";

import { useRouter } from "next/navigation";
import { useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FileInput, Select, TextInput } from "@/components/ui/Controls";
import DatePicker from "@/components/ui/DatePicker";
import { Field } from "@/components/ui/Field";
import Table from "@/components/ui/Table";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { SignupEventChoice } from "@/lib/server/signup-uploads";
import {
  MAX_SIGNUP_FILE_BYTES,
  readSignupFile,
  SIGNUP_UPLOAD_STORAGE,
  signupEventColumns,
  signupFileText,
  type SignupFileRead,
  type SignupUploadInput,
} from "@/lib/signup-upload";
import { staffDate } from "@/lib/staff-time";
import SignupUploadHelp from "./SignupUploadHelp";
import Strip from "./ui/Strip";
import styles from "./SignupUpload.module.css";

const copy = staffCopy.signupUpload;

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
 * The first page of uploading sign-ups: the drop box beside what the file
 * should look like, then, once a file is read, what each of its columns will
 * do, and the event, date and note. It reads the file in the browser, and keeps
 * it in this tab for the preview.
 */
export default function SignupUploadForm({ events, today }: { events: SignupEventChoice[]; today: string }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [eventId, setEventId] = useState("");
  const [column, setColumn] = useState("");
  const [signedOn, setSignedOn] = useState(today);
  const [note, setNote] = useState("");

  async function choose(file: File) {
    setChosen(null);
    setColumn("");
    if (NOT_CSV.test(file.name)) return setFileError(copy.drop.notCsv(file.name));
    if (file.size > MAX_SIGNUP_FILE_BYTES) return setFileError(copy.drop.tooBig);
    const text = signupFileText(await file.arrayBuffer());
    setFileError(null);
    setChosen({ name: file.name, text, read: readSignupFile(text) });
  }

  function dropped(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const [file] = event.dataTransfer.files;
    if (file) void choose(file);
  }

  const read = chosen?.read.ok ? chosen.read : null;
  const choices = read ? signupEventColumns(read) : [];
  // With only one column it could be, there's nothing to choose.
  const eventColumn = eventId ? column || (choices.length === 1 ? choices[0] : "") : "";

  function preview() {
    const input: SignupUploadInput = {
      csv: chosen!.text,
      filename: chosen!.name,
      eventId: eventId || null,
      eventColumn: eventColumn || null,
      signedOn,
      note,
    };
    sessionStorage.setItem(SIGNUP_UPLOAD_STORAGE, JSON.stringify(input));
    router.push("/staff/supporters/upload/preview");
  }

  return (
    <div className={styles.page}>
      <div className={styles.start}>
        <label
          className={dragging ? `${styles.drop} ${styles.dragging}` : styles.drop}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={dropped}
        >
          <strong>{chosen ? chosen.name : copy.drop.title}</strong>
          <span>{read ? copy.drop.read(read.rows.length, read.columns.length) : copy.drop.or}</span>
          {chosen && <span className={styles.another}>{copy.drop.another}</span>}
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
        <SignupUploadHelp />
      </div>

      {fileError && <Strip tone="red">{fileError}</Strip>}
      {chosen && !chosen.read.ok && <Strip tone="red">{refusedWords(chosen.read)}</Strip>}

      {read && (
        <>
          <section className={styles.section}>
            <h2>{copy.columns.title}</h2>
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
                      {c.heading === eventColumn ? (
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
          </section>

          <section className={styles.fields}>
            <Field label={copy.form.event}>
              <Select value={eventId} onChange={(event) => setEventId(event.target.value)}>
                <option value="">{copy.form.noEvent}</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}, {staffDate(event.startAt)}
                  </option>
                ))}
              </Select>
            </Field>
            {eventId && choices.length > 0 && (
              <Field label={copy.form.eventColumn}>
                <Select value={eventColumn} onChange={(event) => setColumn(event.target.value)}>
                  <option value="" disabled>
                    {copy.form.chooseColumn}
                  </option>
                  {choices.map((heading) => (
                    <option key={heading} value={heading}>
                      {heading}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={copy.form.signedOn}>
              <DatePicker value={signedOn} onChange={setSignedOn} />
            </Field>
            <Field label={copy.form.note}>
              <TextInput
                value={note}
                placeholder={copy.form.noteHint}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          </section>
          {eventId && choices.length === 0 && <Strip tone="amber">{copy.form.noEventColumn}</Strip>}
          <div>
            <Button variant="primary" fit disabled={Boolean(eventId) && !eventColumn} onClick={preview}>
              {copy.form.preview}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
