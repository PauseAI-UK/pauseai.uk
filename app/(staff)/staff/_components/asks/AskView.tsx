import { buttonClass } from "@/components/ui/Button";
import { Muted } from "@/components/ui/Text";
import Tag from "@/components/ui/Tag";
import { askPeriod } from "@/lib/asks/ask-groups";
import { askAnswersHref, INVITED, type AskKind } from "@/lib/asks/asks";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import type { AskAnswerGroup, AskPageData } from "@/lib/asks/records.server";
import { answeredOf, ANSWER_TONES, askCounts } from "./AsksList";
import Band, { BandFact } from "../ui/Band";
import Counts from "../ui/Counts";
import Empty from "../ui/Empty";
import Grid, { Card } from "../ui/Grid";
import StaffLink from "../ui/StaffLink";
import { askedLine } from "./AskLine";
import AskKindIcon from "./AskKindIcon";
import IconText from "../ui/IconText";
import AskWays from "./AskWays";
import styles from "./AskView.module.css";
import ExternalLink from "../ui/ExternalLink";
import { asksCopy } from "@/lib/asks/copy";

const copy = asksCopy.asks;
const page = copy.page;

/**
 * Where an ask's link leads, as its text, as the page's title already names
 * what's there: the site, without www, or on ours, the page or file's own
 * name ("Frontier-AI-Open-Letter.pdf"). The table takes only links that
 * start https:// or /.
 */
function whereItIs(url: string): string | undefined {
  return url.startsWith("/") ? url.split("/").filter(Boolean).at(-1) : new URL(url).hostname.replace(/^www\./, "");
}

/**
 * What a column of answers is called, as a politician's form and the politicians list's filter say it: its answer,
 * or for those asked who haven't, the words of the ask's kind.
 */
function groupName(key: string, kind: AskKind): string {
  return key === INVITED ? staffVocabulary.noReplyYet[kind] : staffVocabulary.statuses[key];
}

/**
 * One answer's column: its top, its name and how many gave it, in its
 * colour; the first few who gave it, those in "other" each tagged with what
 * it was, and those out of office saying so after their party; and, with
 * anyone in it, the way to them all, saying how many when it shows only
 * some. The top and that way lead to them on the politicians list, which
 * shows those out of office too when the column has any.
 */
function AnswerColumn({ group, kind, slug }: { group: AskAnswerGroup; kind: AskKind; slug: string }) {
  const all = askAnswersHref(slug, group.key, group.outOfOffice > 0);
  const heading = (
    <>
      <span>{groupName(group.key, kind)}</span> <strong>{group.total.toLocaleString("en-GB")}</strong>
    </>
  );
  return (
    <section className={styles.column} data-tone={ANSWER_TONES[group.key]}>
      <h2 className={styles.columnHead}>
        {group.total > 0 ? <StaffLink href={all}>{heading}</StaffLink> : <span>{heading}</span>}
      </h2>
      {group.people.length === 0 ? (
        <div className={styles.columnFoot}>
          <Empty>{page.none}</Empty>
        </div>
      ) : (
        <ul className={styles.people}>
          {group.people.map((person) => (
            <li key={person.politicianId}>
              <span className={styles.person}>
                <StaffLink href={`/staff/politicians/${person.politicianId}`}>{person.name}</StaffLink>
                <Muted>
                  {[
                    person.party,
                    person.personStatus !== "in_office" && staffVocabulary.personStatuses[person.personStatus],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Muted>
              </span>
              {person.status === "other" && person.note && <Tag tone={ANSWER_TONES.other}>{person.note}</Tag>}
            </li>
          ))}
        </ul>
      )}
      {group.total > 0 && (
        <p className={styles.columnFoot}>
          <StaffLink href={all}>{group.total > group.people.length ? page.allOf(group.total) : page.asList}</StaffLink>
        </p>
      )}
    </section>
  );
}

/**
 * An ask's page, in a mailing's shape: over its title what they were asked to
 * do, its date and where to read it; then its answers, a column each, each
 * leading to those in it on the politicians list; and last how we asked, how many were written to, its letters and
 * who replied at its top right, and each campaign and mailing under its kind.
 * It has no letters of its own.
 */
export default function AskView({ ask }: { ask: AskPageData }) {
  const path = `/staff/asks/${ask.slug}`;
  const answered = answeredOf(ask);
  const linkText = ask.url && whereItIs(ask.url);
  return (
    <div className={styles.page}>
      <Band
        title={
          // Its kind's picture first, as a broadcast's title has its channel's; the Asked fact says it in words.
          <IconText tall icon={<AskKindIcon kind={ask.kind} size="1em" />}>
            {ask.title}
          </IconText>
        }
        corner={
          <StaffLink className={buttonClass({ variant: "ghost", size: "small", fit: true })} href={`${path}/edit`}>
            {copy.edit}
          </StaffLink>
        }
      >
        <BandFact label={page.asked}>{askedLine(ask)}</BandFact>
        <BandFact label={ask.kind === "letter" ? page.when : page.on}>{askPeriod(ask)}</BandFact>
        <BandFact label={page.readIt[ask.kind]}>
          {ask.url &&
            (ask.url.startsWith("/") ? (
              <StaffLink href={ask.url}>{linkText}</StaffLink>
            ) : (
              <ExternalLink href={ask.url}>{linkText}</ExternalLink>
            ))}
        </BandFact>
      </Band>
      {answered === 0 && ask.invited === 0 ? (
        <Grid>
          <Card span={6} as="div" title={page.answersTitle} id="answers">
            <Empty>{page.none}</Empty>
          </Card>
        </Grid>
      ) : (
        <section className={styles.columns} aria-label={page.answersTitle}>
          {ask.groups.map((group) => (
            <AnswerColumn key={group.key} group={group} kind={ask.kind} slug={ask.slug} />
          ))}
        </section>
      )}
      <Grid>
        <Card
          span={6}
          look="aside"
          title={page.howWeAsked}
          id="how-we-asked"
          action={
            <div className={styles.howCounts}>
              <Counts small counts={askCounts(ask)} />
            </div>
          }
        >
          {ask.ways.length === 0 ? (
            <p>
              <Muted>{page.noWay}</Muted>
            </p>
          ) : (
            <AskWays ways={ask.ways} wide />
          )}
        </Card>
      </Grid>
    </div>
  );
}
