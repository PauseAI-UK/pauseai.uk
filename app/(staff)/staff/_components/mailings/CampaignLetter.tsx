"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import LinkButton from "@/components/ui/LinkButton";
import { Muted } from "@/components/ui/Text";
import type { CampaignVersion } from "@/lib/mailings/campaigns.server";
import { staffDate } from "@/lib/staff-time";
import MailEmail from "./MailEmail";
import { MailingLetter } from "./MailingLetter";
import StaffLink from "../ui/StaffLink";
import styles from "./CampaignLetter.module.css";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.campaigns;

/**
 * "The letter" of a campaign's page: what people were given, the latest
 * version, or if there's been more than one, one chosen from the list that
 * "Earlier versions" opens, with its subject and
 * its text, its fields as chips and its parts only for some MPs boxed, by
 * `conditions`' labels. Beside how many letters there are, a link to
 * those that changed the wording, in all versions.
 */
export default function CampaignLetter({
  versions,
  changed,
  changedHref,
  conditions = {},
}: {
  versions: CampaignVersion[];
  changed: number;
  changedHref: string;
  conditions?: Record<string, string>;
}) {
  const [key, setKey] = useState(versions[0]?.key ?? "");
  const [choosing, setChoosing] = useState(false);
  const version = versions.find((one) => one.key === key);
  const line = (one: CampaignVersion) =>
    one.body ? copy.versionLine(one.from && staffDate(one.from), one.letters) : copy.beforeVersions(one.letters);
  return (
    <div className={styles.letter}>
      <div className={styles.head}>
        {choosing ? (
          <Field label={copy.version}>
            <Select value={key} onChange={(event) => setKey(event.target.value)}>
              {versions.map((one) => (
                <option key={one.key} value={one.key}>
                  {line(one)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
            {version && <Muted>{line(version)}</Muted>}
            {versions.length > 1 && (
              <LinkButton onClick={() => setChoosing(true)}>{copy.earlierVersions(versions.length - 1)}</LinkButton>
            )}
          </>
        )}
        {changed > 0 && <StaffLink href={changedHref}>{copy.changedLink(changed)}</StaffLink>}
      </div>
      {version?.body ? (
        <MailEmail
          from={<Muted>{copy.fromEach}</Muted>}
          to={<Muted>{mailingsCopy.mailingPages.toEach}</Muted>}
          subject={version.subject}
        >
          <MailingLetter doc={version.body} fields={copy.fields} conditions={conditions} />
        </MailEmail>
      ) : (
        <p>
          <Muted>{version ? copy.ownDrafts : copy.noText}</Muted>
        </p>
      )}
    </div>
  );
}
