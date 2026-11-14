import Table from "@/components/ui/Table";
import Tag from "@/components/ui/Tag";
import type { getSignupUpload, SignupUploadPerson, SignupUploadSummary } from "@/lib/supporters/signup-uploads";
import { signupUploadPath } from "@/lib/supporters/signup-csv";
import { staffDate, staffTime } from "@/lib/staff-time";
import { Muted } from "@/components/ui/Text";
import { monthsAndYears } from "@/lib/dated-groups";
import Counts from "../ui/Counts";
import Empty from "../ui/Empty";
import Grid, { Card, spanClass } from "../ui/Grid";
import ExternalLink from "../ui/ExternalLink";
import PageHead from "../ui/PageHead";
import { LumaReading } from "./SignupUploadPreview";
import StaffLink from "../ui/StaffLink";
import styles from "./SignupUpload.module.css";
import { phoneWords } from "@/lib/phone";
import { supportersCopy } from "./copy";

const copy = supportersCopy.signupUpload;
const words = copy.result;

/**
 * What an import did for a person, kept as it did it, in the preview's
 * lozenges: already imported or already a supporter, what came of the event,
 * and their permission to contact them, which a new entry gives.
 */
function Happened({ person }: { person: SignupUploadPerson }) {
  const said = copy.preview.happens;
  return (
    <span className={styles.lozenges}>
      {!person.newEntry && <Tag>{said.alreadyImported}</Tag>}
      {person.newEntry && person.known && <Tag tone="blue">{said.known[person.known]}</Tag>}
      {person.luma === "going" && <Tag>{said.going}</Tag>}
      {person.luma && person.luma !== "going" && (
        <Tag tone={person.luma === "added" ? "green" : "red"}>{words.luma[person.luma]}</Tag>
      )}
      {person.newEntry && <Tag tone="green">{said.mailing}</Tag>}
      {person.newEntry && person.phone && <Tag tone="green">{said.phone}</Tag>}
    </span>
  );
}

/** The head of an upload's page: its file, and under it what came of it, who did it, and what it was. */
export function SignupUploadHead({ upload }: { upload: SignupUploadSummary }) {
  return (
    <PageHead
      facts={[
        words.summary(upload.imported, upload.heldBack),
        words.by(upload.uploadedBy, staffTime(upload.uploadedAt)),
        words.signedOn(staffDate(new Date(upload.signedOn))),
        upload.eventName && (
          <>
            {words.event} <ExternalLink href={upload.eventUrl!}>{upload.eventName}</ExternalLink>
          </>
        ),
        upload.note && words.note(upload.note),
      ]}
    >
      {words.title(upload.filename)}
    </PageHead>
  );
}

/** What an upload did: each person still held from it, with what Luma said. */
export default function SignupUploadResult({
  upload,
}: {
  upload: NonNullable<Awaited<ReturnType<typeof getSignupUpload>>>;
}) {
  return (
    <Grid>
      <Card span={6}>
        {upload.lumaReading && <LumaReading />}
        {upload.people.length === 0 ? (
          <Empty>{words.none}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>{words.columns.person}</th>
                <th>{copy.help.fields.email.label}</th>
                <th>{words.columns.phone}</th>
                <th>{words.columns.postcode}</th>
                <th>{words.columns.happened}</th>
              </tr>
            </thead>
            <tbody>
              {upload.people.map((person) => (
                <tr key={person.entryId}>
                  <td>
                    {person.supporterId ? (
                      <StaffLink href={`/staff/supporters/${person.supporterId}`}>{person.name}</StaffLink>
                    ) : (
                      person.name
                    )}
                  </td>
                  <td className={styles.email}>{person.email}</td>
                  <td className={styles.nowrap}>{person.phone && phoneWords(person.phone)}</td>
                  <td>{person.postcode}</td>
                  <td className={styles.happens}>
                    <Happened person={person} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </Grid>
  );
}

/** An upload's date: the day and month, and the year too if it isn't this one's. */
function UploadDay({ day, year }: { day: string; year: string }) {
  const said = staffDate(new Date(day));
  return <>{said.endsWith(year) ? said.slice(0, -5) : said}</>;
}

/**
 * The uploads so far, as the mailings are listed: under their months, then
 * years, by the date on the forms, newest first, each a row of that date, its
 * note leading to what it did over its file, event and who uploaded it, and
 * how many it imported and held back. Or that there are none yet.
 */
export function SignupUploadsList({ uploads, now }: { uploads: SignupUploadSummary[]; now: string }) {
  const heads = copy.uploads;
  if (uploads.length === 0) return <Empty>{heads.none}</Empty>;
  const year = now.slice(0, 4);
  return (
    <Grid>
      <div className={spanClass(6)}>
        {monthsAndYears(uploads, (upload) => upload.signedOn, new Date(now)).map((group) => (
          <section key={group.key} aria-labelledby={`uploads-${group.key}`}>
            <h2 id={`uploads-${group.key}`}>{group.heading}</h2>
            <ul className={styles.rows}>
              {group.items.map((upload) => {
                const href = signupUploadPath(upload.id);
                return (
                  <li key={upload.id} className={styles.row}>
                    <span className={styles.when}>
                      <UploadDay day={upload.signedOn} year={year} />
                    </span>
                    <span className={styles.what}>
                      <StaffLink href={href} className={styles.rowTitle}>
                        {upload.note ?? upload.filename}
                      </StaffLink>
                      <Muted>
                        {upload.filename}
                        {upload.eventName && (
                          <>
                            {" · "}
                            <ExternalLink href={upload.eventUrl!}>{upload.eventName}</ExternalLink>
                          </>
                        )}
                        {" · "}
                        {heads.by(upload.uploadedBy)}
                      </Muted>
                    </span>
                    <Counts
                      small
                      counts={[
                        { key: "imported", n: upload.imported, label: heads.imported, href, tone: "green" },
                        { key: "held", n: upload.heldBack, label: heads.heldBack, href, tone: "red" },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Grid>
  );
}
