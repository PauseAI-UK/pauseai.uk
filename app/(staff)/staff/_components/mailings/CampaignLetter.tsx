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
import styles from "./CampaignLetter.module.css";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.campaigns;

/**
 * "The letter" of a campaign's page: what people were given, the latest
 * version, with its subject and its text, its fields as chips and its
 * parts only for some MPs boxed, by `conditions`' labels. Under it, a
 * quiet line of when it was published, by whom, and how many letters
 * started from it; and if there's been more than one, "Earlier versions",
 * which opens the list to choose another.
 */
export default function CampaignLetter({
  versions,
  conditions = {},
}: {
  versions: CampaignVersion[];
  conditions?: Record<string, string>;
}) {
  const [key, setKey] = useState(versions[0]?.key ?? "");
  const [choosing, setChoosing] = useState(false);
  const version = versions.find((one) => one.key === key);
  const line = (one: CampaignVersion) =>
    one.body
      ? copy.versionLine(one.from && staffDate(one.from), one.by, one.letters)
      : copy.beforeVersions(one.letters);
  return (
    <div className={styles.letter}>
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
        version && (
          <p className={styles.versionLine}>
            <Muted>{line(version)}</Muted>
            {versions.length > 1 && (
              <>
                <Muted> · </Muted>
                <LinkButton onClick={() => setChoosing(true)}>{copy.earlierVersions(versions.length - 1)}</LinkButton>
              </>
            )}
          </p>
        )
      )}
    </div>
  );
}
