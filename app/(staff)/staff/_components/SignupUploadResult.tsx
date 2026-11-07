import Table from "@/components/ui/Table";
import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { getSignupUpload, SignupUploadSummary } from "@/lib/server/signup-uploads";
import { staffDate, staffTime } from "@/lib/staff-time";
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
      {upload.eventName && <li>{words.event(upload.eventName)}</li>}
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
    <div className={styles.page}>
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
                <td>{person.phone}</td>
                <td>{person.postcode}</td>
                <td>{person.consent ? copy.preview.yes : copy.preview.no}</td>
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
    </div>
  );
}

/** The earlier uploads, newest first, each leading to what it did. Nothing at all before the first. */
export function SignupUploadsTable({ uploads }: { uploads: SignupUploadSummary[] }) {
  if (uploads.length === 0) return null;
  const heads = copy.uploads;
  return (
    <section className={styles.section}>
      <h2>{heads.title}</h2>
      <Table>
        <thead>
          <tr>
            <th>{heads.file}</th>
            <th>{heads.signedOn}</th>
            <th>{heads.note}</th>
            <th>{heads.event}</th>
            <th>{heads.imported}</th>
            <th>{heads.heldBack}</th>
            <th>{heads.by}</th>
            <th>{heads.when}</th>
          </tr>
        </thead>
        <tbody>
          {uploads.map((upload) => (
            <tr key={upload.id}>
              <td>
                <StaffLink href={`/staff/supporters/upload/${upload.id}`}>{upload.filename}</StaffLink>
              </td>
              <td>{staffDate(upload.signedOn)}</td>
              <td>{upload.note}</td>
              <td>{upload.eventName}</td>
              <td>{upload.imported}</td>
              <td>{upload.heldBack}</td>
              <td>{upload.uploadedBy}</td>
              <td>{staffTime(upload.uploadedAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
