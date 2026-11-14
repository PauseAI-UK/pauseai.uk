import { Muted } from "@/components/ui/Text";
import { askHref } from "@/lib/asks/asks";
import { campaignBySlug, campaignPath } from "@/lib/email-your-mp";
import type { CampaignSummary, CampaignVersion } from "@/lib/mailings/campaigns.server";
import type { LetterSummary } from "@/lib/letters/records.server";
import { type LettersSearch } from "@/lib/staff-search";
import { filtersPath, pageParam } from "@/lib/list-params";
import { staffDate } from "@/lib/staff-time";
import CampaignLetter from "./CampaignLetter";
import { CampaignAsk, campaignCounts } from "./CampaignsOverview";
import Band, { BandFact } from "../ui/Band";
import { CountGroups } from "./CopyCounts";
import { wentAndGone } from "../letters/CopyStatus";
import Grid, { Card } from "../ui/Grid";
import ListFrame, { type ListColumn } from "../ui/ListFrame";
import Progress from "../ui/Progress";
import StaffLink from "../ui/StaffLink";
import AnswerWord from "../asks/AnswerWord";
import LetterStatus from "../letters/LetterStatus";
import styles from "./MailingView.module.css";
import TestTag from "../ui/TestTag";
import ExternalLink from "../ui/ExternalLink";
import When from "../ui/When";
import { asksCopy } from "@/lib/asks/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { mailingsCopy } from "./copy";
import { lettersCopy } from "../letters/copy";

const copy = mailingsCopy.campaigns;
const words = lettersCopy.letters;

/** A campaign's letters' columns: the politician, with their seat, party and answer; who wrote it and when; how much was their own; how it went, leading to it. */
const campaignLetterColumns: ListColumn<LetterSummary>[] = [
  {
    key: "politician",
    label: copy.columns.politician,
    cell: (l) => (
      <span className={styles.who}>
        <span>
          <StaffLink href={`/staff/politicians/${l.politicianId}`}>{l.mpName}</StaffLink>
          <TestTag isTest={l.isTest} />
        </span>
        <Muted>{[l.constituency, l.party].filter(Boolean).join(" · ")}</Muted>
        {l.answer && (
          <span className={styles.answer}>
            <AnswerWord status={l.answer} />
          </span>
        )}
      </span>
    ),
  },
  {
    key: "from",
    label: copy.columns.from,
    cell: (l) => (
      <span className={styles.who}>
        {l.supporterId === null ? (
          l.senderName
        ) : (
          <StaffLink href={`/staff/supporters/${l.supporterId}`}>{l.senderName}</StaffLink>
        )}
        <Muted>
          <When at={l.createdAt} day />
        </Muted>
      </span>
    ),
  },
  {
    key: "ownWords",
    label: copy.columns.ownWords,
    short: true,
    cell: (l) => (l.ownWords === null ? <Muted>–</Muted> : words.ownWords(l.ownWords)),
  },
  {
    key: "status",
    label: copy.columns.status,
    short: true,
    cell: (l) => (
      <span className={styles.who}>
        <LetterStatus
          status={l.status}
          answered={Boolean(l.answer)}
          replied={Boolean(l.repliedAt)}
          autoReplied={Boolean(l.autoRepliedAt)}
          sentBy={l.backend === "airtable" ? null : l.backend}
        />
        <StaffLink href={`/staff/letters/${l.id}`}>{staffVocabulary.theLetter}</StaffLink>
      </span>
    ),
  },
];

/** What a campaign's page shows. */
export type CampaignPageProps = {
  campaign: CampaignSummary;
  versions: CampaignVersion[];
  changed: number;
  letters: { letters: LetterSummary[]; total: number; pages: number; pageSize: number };
  search: LettersSearch;
};

/** Where the public reads a campaign: its page on the site, or where its letter is kept; nothing if neither. */
function PublicPage({ campaign }: { campaign: CampaignSummary }) {
  const code = campaignBySlug(campaign.slug);
  if (code) return <StaffLink href={campaignPath(code)}>{copy.seePublicPage}</StaffLink>;
  if (!campaign.url) return <Muted>–</Muted>;
  return <ExternalLink href={campaign.url}>{copy.seePublicPage}</ExternalLink>;
}

/**
 * A campaign's page, in a mailing's shape: its band of who it's from and to,
 * what it asks and when, with its counts; how many answered its ask; then "The letter" beside
 * "Letters", as "The email" is beside "Recipients".
 */
export default function CampaignView({ campaign, versions, changed, letters, search }: CampaignPageProps) {
  const path = `/staff/campaigns/${campaign.slug}`;
  const { page, ...filters } = search;
  void page;
  // Each count shows those it counts, keeping the list's other filters; pressed again, it shows them all.
  const counts = campaignCounts(campaign).map((count) => {
    const current = count.key === search.tab;
    return {
      ...count,
      href: filtersPath(path, { ...filters, tab: current ? "" : count.key }),
      current,
      title: current ? copy.showAll : undefined,
    };
  });
  return (
    <div className={styles.page}>
      <Band title={campaign.title} aside={<CountGroups groups={wentAndGone(counts)} />}>
        <BandFact label={copy.from}>{copy.supporters(campaign.supporters)}</BandFact>
        <BandFact label={copy.to}>{staffVocabulary.politicians(campaign.politicians)}</BandFact>
        <BandFact label={campaign.ask ? asksCopy.asks.askTo[campaign.askKind!] : mailingsCopy.mailings.fields.ask}>
          {campaign.ask ? (
            <StaffLink href={askHref(campaign.ask)}>{campaign.askTitle}</StaffLink>
          ) : (
            <CampaignAsk campaign={campaign} />
          )}
        </BandFact>
        <BandFact label={copy.started}>{campaign.firstAt && staffDate(campaign.firstAt)}</BandFact>
        <BandFact label={copy.last}>{campaign.lastAt && staffDate(campaign.lastAt)}</BandFact>
        <BandFact label={copy.publicPage}>
          <PublicPage campaign={campaign} />
        </BandFact>
      </Band>
      {campaign.ask && (
        <Grid>
          <Card span={6} as="div">
            <Progress
              value={campaign.answered}
              max={campaign.politicians}
              tone="green"
              label={lettersCopy.copyStates.tabs.answered}
              big
            >
              {mailingsCopy.mailingPages.answeredBar(campaign.answered, campaign.politicians)}
            </Progress>
          </Card>
        </Grid>
      )}
      <Grid>
        <Card span={3} look="aside" title={copy.theLetter} id="campaign-letter">
          <CampaignLetter
            versions={versions}
            changed={changed}
            changedHref={filtersPath(path, { ...filters, tab: "changed" })}
          />
        </Card>
        <Card span={3} as="div">
          <div className={styles.recipientsHead}>
            <h2>
              {!search.tab
                ? copy.lettersTitle
                : search.tab === "changed"
                  ? copy.tabs.changed
                  : lettersCopy.copyStates.tabs[search.tab]}
            </h2>
            {search.tab && <StaffLink href={filtersPath(path, { ...filters, tab: "" })}>{copy.showAll}</StaffLink>}
          </div>
          <ListFrame
            count={lettersCopy.letters.total(letters.total)}
            total={letters.total}
            page={Number(search.page) || 1}
            pages={letters.pages}
            pageSize={letters.pageSize}
            href={(n) => filtersPath(path, { ...filters, page: "" }, pageParam(n))}
            columns={campaignLetterColumns}
            rows={letters.letters}
            rowKey={(l) => l.id}
            empty={words.none}
          />
        </Card>
      </Grid>
    </div>
  );
}
