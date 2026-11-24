import "server-only";
import { firstOf, type Params, type ParamValue } from "@/lib/list-params";
import { query } from "@/lib/server/db.server";
import { consentLeftOut } from "@/lib/supporters/contact-permissions";
import { termsValues, type BroadcastChannel } from "./broadcasts";
import { broadcastsCopy } from "./copy";
import { COPY_STATE, COPY_WHY, type CopyState } from "./copy-states.server";
import { getWrittenBroadcast, type WrittenBroadcast } from "./drafts.server";

// What the supporters' pages show of broadcasts: those a supporter was sent,
// on their page, and the draft the list is choosing who for. Apart from the
// broadcasts' own pages (./pages.server.ts), so a change to those doesn't
// reach the supporters' pages.

/** A broadcast sent to a supporter, on their page. */
export type SupporterBroadcastRow = {
  copyId: number;
  messageId: number;
  title: string;
  channel: BroadcastChannel;
  status: string;
  skipReason: string | null;
  sentAt: Date | null;
  /** Where it stands, and why, as a recipient's row has them. */
  state: CopyState;
  why: string | null;
};

/** The broadcasts a supporter was sent, newest first. */
export async function broadcastsToSupporter(supporterId: number): Promise<SupporterBroadcastRow[]> {
  return query<SupporterBroadcastRow>(
    `SELECT c.id::int AS "copyId", m.id::int AS "messageId", m.title, m.channel, c.status, c.skip_reason AS "skipReason",
       c.sent_at AS "sentAt", ${COPY_STATE} AS state, ${COPY_WHY} AS why
     FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE c.supporter_id = $1 ORDER BY c.sent_at DESC NULLS FIRST, c.id DESC`,
    [supporterId],
  );
}

/** The draft the supporters list is choosing who for. */
export type ChoosingBroadcast = Pick<WrittenBroadcast, "id" | "channel" | "topics"> & {
  title: string;
  /** Nothing written yet, as from New broadcast. */
  blank: boolean;
};

/** The Consent a draft being chosen for goes under, as the list's Consent filter writes it: a value, or one a topic. */
export function choosingConsent(choosing: ChoosingBroadcast): string | string[] {
  const values = termsValues(choosing);
  return values.length === 1 ? values[0] : values;
}

/**
 * The supporters list's filters, `params`, while it's choosing who the draft
 * `broadcast` names goes to: that draft, and its Consent over any other the
 * list finds, as the list can't change it, keeping the consents it leaves
 * out. As they are, with no such draft.
 */
export async function withChoosing(
  params: Params,
  broadcast: ParamValue | undefined,
): Promise<{ choosing?: ChoosingBroadcast; params: Params }> {
  const choosing = await choosingBroadcast(firstOf(broadcast));
  if (!choosing) return { params };
  const leftOut = consentLeftOut(params.contact);
  const contact = leftOut.length > 0 ? [...termsValues(choosing), ...leftOut] : choosingConsent(choosing);
  return { choosing, params: { ...params, contact } };
}

/** The draft the list's `broadcast` parameter names; undefined for none, or one no longer a draft. */
export async function choosingBroadcast(id: string): Promise<ChoosingBroadcast | undefined> {
  const draft = /^\d+$/.test(id) ? await getWrittenBroadcast(Number(id)) : undefined;
  if (draft?.state !== "draft") return undefined;
  return {
    id: draft.id,
    channel: draft.channel,
    topics: draft.topics,
    title: draft.title || broadcastsCopy.broadcastPages.newTitle[draft.channel],
    blank: !draft.title,
  };
}
