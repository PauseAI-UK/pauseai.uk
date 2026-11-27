"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Controls";
import { Field } from "@/components/ui/Field";
import LinkButton from "@/components/ui/LinkButton";
import { staffMemberText } from "@/lib/staff-member";
import { StaffSentence } from "../ui/StaffMember";
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
  unpublished,
}: {
  versions: CampaignVersion[];
  conditions?: Record<string, string>;
  /** A draft with changes that aren't published, said under the version's line. */
  unpublished?: { updatedAt: Date; updatedBy: string | null };
}) {
  const [key, setKey] = useState(versions[0]?.key ?? "");
  const [choosing, setChoosing] = useState(false);
  const version = versions.find((one) => one.key === key);
  // As a choice in the list, which can only be words.
  const line = (one: CampaignVersion) =>
    one.body
      ? copy.versionLine(one.from && staffDate(one.from), one.by && staffMemberText(one.by), one.letters)
      : copy.beforeVersions(one.letters);
  // Under the letter, naming whoever published it as staff pages do.
  const shown = (one: CampaignVersion) =>
    one.body && one.by ? (
      <StaffSentence
        words={(who) => copy.versionLine(one.from && staffDate(one.from), who, one.letters)}
        email={one.by}
      />
    ) : (
      line(one)
    );
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
            <Muted>{shown(version)}</Muted>
            {versions.length > 1 && (
              <>
                <Muted> · </Muted>
                <LinkButton onClick={() => setChoosing(true)}>{copy.earlierVersions(versions.length - 1)}</LinkButton>
              </>
            )}
          </p>
        )
      )}
      {unpublished && (
        <p className={styles.versionLine}>
          <Muted>
            {unpublished.updatedBy ? (
              <StaffSentence
                words={(who) => copy.unpublished(staffDate(unpublished.updatedAt), who)}
                email={unpublished.updatedBy}
              />
            ) : (
              copy.unpublished(staffDate(unpublished.updatedAt), null)
            )}
          </Muted>
        </p>
      )}
    </div>
  );
}
