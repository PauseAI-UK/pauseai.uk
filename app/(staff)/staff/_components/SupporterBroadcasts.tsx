import Tag from "@/components/ui/Tag";
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import type { SupporterBroadcastRow } from "@/lib/server/broadcast-pages";
import { staffDate } from "@/lib/staff-time";
import { BroadcastChannelName, copyStatus, copyWent } from "./BroadcastView";
import { ListTable, type ListColumn } from "./ui/ListFrame";
import StaffLink from "./ui/StaffLink";
import details from "./Details.module.css";
import styles from "./Broadcasts.module.css";

const copy = staffCopy.broadcastPages;

const COLUMNS: ListColumn<SupporterBroadcastRow>[] = [
  {
    key: "message",
    label: copy.supporterColumns.message,
    cell: (m) => (
      <span className={styles.stack}>
        <StaffLink href={`/staff/broadcasts/${m.messageId}`}>{m.title || copy.untitled}</StaffLink>
        <Muted>
          <BroadcastChannelName channel={m.channel} />
          {m.sentAt && staffDate(m.sentAt)}
        </Muted>
      </span>
    ),
  },
  {
    key: "status",
    label: copy.supporterColumns.status,
    short: true,
    cell: (m) => {
      const { words, tone } = copyStatus(m, m.channel);
      return (
        <span className={styles.stack}>
          <Tag tone={tone}>{words}</Tag>
          {copyWent(m) && (
            <StaffLink href={`/staff/broadcasts/${m.messageId}/${m.copyId}`}>{copy.threadLink}</StaffLink>
          )}
        </span>
      );
    },
  },
];

/** The broadcasts a supporter was sent, newest first: each name leads to the broadcast, and its link to this supporter's copy. */
export default function SupporterBroadcasts({ broadcasts }: { broadcasts: SupporterBroadcastRow[] }) {
  return (
    <section aria-labelledby="broadcasts">
      <h2 id="broadcasts">{copy.supporterTitle}</h2>
      {broadcasts.length ? (
        <ListTable columns={COLUMNS} rows={broadcasts} rowKey={(m) => m.copyId} />
      ) : (
        <p className={details.none}>{copy.supporterNone}</p>
      )}
    </section>
  );
}
