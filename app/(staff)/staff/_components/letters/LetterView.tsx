import StaffLink from "../ui/StaffLink";
import type { ReactNode } from "react";
import type { Ask } from "@/lib/asks/records.server";
import type { LetterDetails } from "@/lib/letters/records.server";
import CampaignName from "../CampaignName";
import { historyOf, LetterHistory, letterTitle } from "./LetterHistory";
import LetterStatus from "./LetterStatus";
import Grid, { Card, Column, spanClass } from "../ui/Grid";
import PageHead from "../ui/PageHead";
import styles from "./LetterView.module.css";
import TestTag from "../TestTag";
import { lettersCopy } from "./copy";

/** What a letter's page shows of the politician it's to: whether they're a test one, their seat and party, and their answers. */
type LetterPolitician = {
  isTest: boolean;
  constituency: string | null;
  party: string | null;
  statuses: Record<string, unknown>;
};

/** The box to set the politician's answer to `ask` in, as their page has it. */
type AnswerBox = (ask: Ask) => ReactNode;

/**
 * The card of what a letter asks: the ask, if it makes one, in the box a
 * politician's page shows it in, to set their answer from what they said;
 * for a supporter's, under it, the campaign it's based on, leading to it,
 * or the campaign alone when it makes no ask. Nothing for one of PauseAI's
 * that makes none.
 */
function AskCard({ letter, ask, answer }: { letter: LetterDetails; ask: Ask | undefined; answer: AnswerBox }) {
  if (!ask && letter.kind === "pauseai") return null;
  const campaign = letter.kind === "supporter" && <CampaignName slug={letter.campaign} title={letter.campaignTitle} />;
  return (
    <Card
      look="aside"
      title={ask ? lettersCopy.letters.detail.ask : lettersCopy.letters.columns.campaign}
      id="ask-title"
    >
      {ask ? (
        <>
          {answer(ask)}
          {campaign && (
            <p className={styles.campaign}>
              {lettersCopy.letters.detail.basedOn} {campaign}
            </p>
          )}
        </>
      ) : (
        <p className={styles.campaignAlone}>{campaign}</p>
      )}
    </Card>
  );
}

/**
 * A letter's page, a supporter's or one of a mailing's: its title and how
 * it stands, tagged when it's to a test politician; under it the
 * politician, leading to their page, with their seat and party; then
 * `children`, the letter as an email and its replies (LetterThread), beside
 * what it asks (AskCard), as wide as a politician's page has it, and what
 * happened to it. The thread says who it's from and to and when, so nothing
 * repeats it.
 */
export default function LetterView({
  letter,
  politician,
  asks,
  answer,
  children,
}: {
  letter: LetterDetails;
  politician: LetterPolitician;
  /** Every ask, to find the letter's. */
  asks: Ask[];
  answer: AnswerBox;
  children: ReactNode;
}) {
  const slug = letter.kind === "supporter" ? letter.campaignAsk : letter.mailingAsk;
  const ask = asks.find((one) => one.slug === slug);
  const personalised = letter.kind === "pauseai" && letter.personalised && lettersCopy.letters.personalised;
  return (
    <>
      <PageHead
        tags={
          <>
            <LetterStatus
              status={letter.status}
              skipReason={letter.kind === "pauseai" ? letter.skipReason : null}
              answered={Boolean(ask && politician.statuses[ask.slug])}
              replied={Boolean(letter.repliedAt)}
              autoReplied={letter.events.some((event) => event.status === "auto_reply")}
              // A mailing's letter goes by Gmail, but one copied from Airtable; a supporter's by Gmail or Postmark.
              sentBy={letter.kind === "pauseai" && letter.backend !== "airtable" ? "gmail" : null}
            />
            <TestTag isTest={politician.isTest} />
          </>
        }
        facts={[
          <StaffLink key="politician" href={`/staff/politicians/${letter.politicianId}`}>
            {letter.mpName}
          </StaffLink>,
          politician.constituency,
          politician.party,
          personalised,
        ]}
      >
        {letterTitle(letter)}
      </PageHead>
      <Grid>
        <div className={spanClass(3)}>{children}</div>
        <Column span={3}>
          <AskCard letter={letter} ask={ask} answer={answer} />
          <Card look="log" title={lettersCopy.letters.detail.historyTitle} id="letter-history">
            <LetterHistory events={historyOf(letter)} />
          </Card>
        </Column>
      </Grid>
    </>
  );
}
