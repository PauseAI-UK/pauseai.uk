import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import type { SupporterBroadcastRow } from "@/lib/server/broadcast-pages";
import { staffDate } from "@/lib/staff-time";
import ChannelIcon from "@/components/ui/ChannelIcon";
import { copyWent } from "./BroadcastView";
import IconText from "./ui/IconText";
import { CopyStatus } from "./CopyStatus";
import Empty from "./ui/Empty";
import { Card } from "./ui/Grid";
import { ListTable, type ListColumn } from "./ui/ListFrame";
import StaffLink from "./ui/StaffLink";
import styles from "./Broadcasts.module.css";

const copy = staffCopy.broadcastPages;

const COLUMNS: ListColumn<SupporterBroadcastRow>[] = [
  {
    key: "message",
    label: copy.supporterColumns.message,
    cell: (m) => (
      <span className={styles.stack}>
        {/* Its channel's picture before its name, as on the list of broadcasts; the line under says it in words. */}
        <IconText icon={<ChannelIcon channel={m.channel} size={16} />}>
          <StaffLink href={`/staff/broadcasts/${m.messageId}`}>{m.title || copy.untitled}</StaffLink>
        </IconText>
        <Muted>
          {copy.channels[m.channel]}
          {m.sentAt && ` · ${staffDate(m.sentAt)}`}
        </Muted>
      </span>
    ),
  },
  {
    key: "status",
    label: copy.supporterColumns.status,
    short: true,
    cell: (m) => {
      return (
        <span className={styles.stack}>
          <CopyStatus copyOf={m} />
          {copyWent(m) && (
            <StaffLink href={`/staff/broadcasts/${m.messageId}/${m.copyId}`}>{copy.threadLink}</StaffLink>
          )}
        </span>
      );
    },
  },
];

/** The broadcasts a supporter was sent, a card of their page, newest first: each name leads to the broadcast, and its link to this supporter's copy. */
export default function SupporterBroadcasts({ broadcasts }: { broadcasts: SupporterBroadcastRow[] }) {
  return (
    <Card title={copy.supporterTitle} id="broadcasts">
      {broadcasts.length ? (
        <ListTable columns={COLUMNS} rows={broadcasts} rowKey={(m) => m.copyId} />
      ) : (
        <Empty>{copy.supporterNone}</Empty>
      )}
    </Card>
  );
}
