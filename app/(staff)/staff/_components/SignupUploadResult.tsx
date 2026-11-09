import Table from "@/components/ui/Table";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { getSignupUpload, SignupUploadSummary } from "@/lib/server/signup-uploads";
import { signupUploadPath } from "@/lib/signup-upload";
import { staffDate, staffTime } from "@/lib/staff-time";
import { Muted } from "@/components/ui/Text";
import { monthsAndYears } from "@/lib/dated-groups";
import Counts from "./ui/Counts";
import Grid, { Card, spanClass } from "./ui/Grid";
import ExternalLink from "./ui/ExternalLink";
import StaffLink from "./ui/StaffLink";
import styles from "./SignupUpload.module.css";

const copy = staffCopy.signupUpload;
const words = copy.result;

/** The upload's own line: what came of it, who did it, and what it was. */
function UploadFacts({ upload }: { upload: SignupUploadSummary }) {
  return (
    <ul className={styles.summary}>
      <li>{words.summary(upload.imported, upload.heldBack)}</li>
      <li>{words.by(upload.uploadedBy, staffTime(upload.uploadedAt))}</li>
      <li>{words.signedOn(staffDate(upload.signedOn))}</li>
      {upload.eventName && (
        <li>
          {words.event} <ExternalLink href={upload.eventUrl!}>{upload.eventName}</ExternalLink>
        </li>
      )}
      {upload.note && <li>{words.note(upload.note)}</li>}
    </ul>
  );
}

/** What an upload did: its facts, and each person still held from it, with what Luma said. */
export default function SignupUploadResult({
  upload,
}: {
  upload: NonNullable<Awaited<ReturnType<typeof getSignupUpload>>>;
}) {
  return (
    <Grid>
      <Card span={6}>
        <UploadFacts upload={upload} />
        {upload.people.length === 0 ? (
          <p>{words.none}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>{words.columns.person}</th>
                <th>{words.columns.phone}</th>
                <th>{words.columns.postcode}</th>
                <th>{words.columns.permission}</th>
                <th>{words.columns.luma}</th>
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
                    <br />
                    {person.email}
                  </td>
                  <td className={styles.nowrap}>{person.phone}</td>
                  <td>{person.postcode}</td>
                  <td>{person.consent ? words.yes : words.no}</td>
                  <td>
                    {person.lumaStatus ? (
                      <Tag tone={person.lumaStatus === "added" ? "green" : "red"}>{words.luma[person.lumaStatus]}</Tag>
                    ) : (
                      words.noLuma
                    )}
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
  const said = staffDate(day);
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
  if (uploads.length === 0) return <p>{heads.none}</p>;
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
