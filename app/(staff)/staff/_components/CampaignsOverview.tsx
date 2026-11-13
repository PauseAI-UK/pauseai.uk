import { Muted } from "@/components/ui/Text";
import { askHref } from "@/lib/asks";
import { staffCopy } from "@/lib/content/staff-interface";
import { monthsAndYears } from "@/lib/dated-groups";
import type { CampaignSummary } from "@/lib/server/campaigns";
import { staffDate } from "@/lib/staff-time";
import { countsOpening, type Count } from "./ui/Counts";
import { NeedsAndFine } from "./CopyCounts";
import { stateCounts } from "./CopyStatus";
import Empty from "./ui/Empty";
import Grid, { spanClass } from "./ui/Grid";
import StaffLink from "./ui/StaffLink";
import styles from "./MailingsOverview.module.css";

const copy = staffCopy.campaigns;

/** How a campaign's letters stand, a count for each state, as a mailing's are told (mailingCounts). */
export function campaignCounts(campaign: CampaignSummary): Count[] {
  return stateCounts(campaign.states, ["sent", "replied", "answered", "spam", "error", "unreached"]);
}

/** A campaign's ask, as its row and its page lead into it: "Ask to sign" and its title. */
export function CampaignAsk({ campaign }: { campaign: CampaignSummary }) {
  if (!campaign.ask) return <>{staffCopy.asks.noAsk}</>;
  return (
    <>
      {staffCopy.asks.askTo[campaign.askKind!]} <StaffLink href={askHref(campaign.ask)}>{campaign.askTitle}</StaffLink>
    </>
  );
}

/**
 * The days a campaign's letters were written, first to last, or one day if
 * they're the same: a year is said only once, and not if it's `year`.
 */
export function letterRange(first: Date, last: Date, year: string): string {
  const [from, to] = [staffDate(first), staffDate(last)];
  const plain = (day: string, of: string) => (day.endsWith(of) ? day.slice(0, -5) : day);
  if (from === to) return plain(to, year);
  return `${plain(from, to.slice(-4))} – ${plain(to, year)}`;
}

/** One campaign, a row: when its letters were written, or that it has none; its title, who it's from, how far it reached and its ask; then its counts. */
function Row({ campaign, year }: { campaign: CampaignSummary; year: string }) {
  const href = `/staff/campaigns/${campaign.slug}`;
  return (
    <li className={styles.row}>
      <span className={styles.when}>
        {campaign.firstAt && campaign.lastAt ? letterRange(campaign.firstAt, campaign.lastAt, year) : copy.noLetters}
      </span>
      <span className={styles.what}>
        <StaffLink href={href} className={styles.title}>
          {campaign.title}
        </StaffLink>
        <Muted>
          {copy.fromSupporters}
          {campaign.letters > 0 && ` · ${copy.lettersTo(campaign.letters, campaign.politicians)}`}
          {" · "}
          <CampaignAsk campaign={campaign} />
        </Muted>
      </span>
      <span className={styles.standing}>
        <NeedsAndFine counts={countsOpening(href, campaignCounts(campaign))} />
      </span>
    </li>
  );
}

/**
 * The list of campaigns, built as the mailings list is: first those with no
 * letters yet, then month and year sections, each campaign under the month of
 * its most recent letter, a row with the same counts box.
 */
export default function CampaignsOverview({ campaigns, now }: { campaigns: CampaignSummary[]; now: string }) {
  if (campaigns.length === 0) return <Empty>{copy.none}</Empty>;
  const at = new Date(now);
  const year = now.slice(0, 4);
  const when = (campaign: CampaignSummary) => campaign.lastAt!.toISOString();
  const none = campaigns.filter((campaign) => !campaign.lastAt);
  const written = campaigns.filter((campaign) => campaign.lastAt);
  return (
    <Grid>
      <div className={spanClass(6)}>
        {none.length > 0 && (
          <ul className={styles.rows}>
            {none.map((campaign) => (
              <Row key={campaign.slug} campaign={campaign} year={year} />
            ))}
          </ul>
        )}
        {monthsAndYears(written, when, at).map((group) => (
          <section key={group.key} aria-labelledby={`campaigns-${group.key}`} className={styles.group}>
            <h2 id={`campaigns-${group.key}`}>{group.heading}</h2>
            <ul className={styles.rows}>
              {group.items.map((campaign) => (
                <Row key={campaign.slug} campaign={campaign} year={year} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Grid>
  );
}
