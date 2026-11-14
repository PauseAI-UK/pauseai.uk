// The staff interface's broadcasts to supporters: from the supporters list, the
// writer, the list of them, each one's page, and one copy as sent.
import { optOutFormGallery } from "@/app/(staff)/staff/_components/supporters/OptOutForm.gallery";
import type { Group } from "../_components/types";
import { draftWriterGallery } from "@/app/(staff)/staff/_components/mailings/DraftWriter.gallery";
import { copyCountsGallery } from "@/app/(staff)/staff/_components/mailings/CopyCounts.gallery";
import { copyStatusGallery } from "@/app/(staff)/staff/_components/letters/CopyStatus.gallery";
import { mailingViewGallery } from "@/app/(staff)/staff/_components/mailings/MailingView.gallery";
import { broadcastConsentGallery } from "@/app/(staff)/staff/_components/broadcasts/BroadcastConsent.gallery";
import { broadcastSupportersGallery } from "@/app/(staff)/staff/_components/broadcasts/BroadcastSupporters.gallery";
import { channelWriterGallery } from "@/app/(staff)/staff/_components/broadcasts/ChannelWriter.gallery";
import { broadcastWriterGallery } from "@/app/(staff)/staff/_components/broadcasts/BroadcastWriter.gallery";
import { broadcastsOverviewGallery } from "@/app/(staff)/staff/_components/broadcasts/BroadcastsOverview.gallery";
import { broadcastViewGallery } from "@/app/(staff)/staff/_components/broadcasts/BroadcastView.gallery";
import { broadcastForGallery } from "@/app/(staff)/staff/_components/broadcasts/BroadcastFor.gallery";
import { messageCopyViewGallery } from "@/app/(staff)/staff/_components/broadcasts/MessageCopyView.gallery";
import { replyActionsGallery } from "@/app/(staff)/staff/_components/broadcasts/ReplyActions.gallery";
import { copyReplyGallery } from "@/app/(staff)/staff/_components/broadcasts/CopyReply.gallery";
import { answerableReplyGallery } from "@/app/(staff)/staff/_components/broadcasts/AnswerableReply.gallery";
import { supporterBroadcastsGallery } from "@/app/(staff)/staff/_components/broadcasts/SupporterBroadcasts.gallery";
import { textBubbleGallery } from "@/app/(staff)/staff/_components/broadcasts/TextBubble.gallery";

// MailingView's examples here, after the one the mailings group shows.
const [, mailingStanding, mailingWhen] = mailingViewGallery;
// BroadcastView's examples, with how a copy went between its first two.
const [broadcastChannelMark, broadcastWaiting, broadcastView] = broadcastViewGallery;

const [, unsubscribeForm] = optOutFormGallery;

export const staffBroadcasts: Group = {
  id: "staff-broadcasts",
  title: "The staff interface: broadcasts to supporters",
  examples: [
    ...broadcastConsentGallery,
    ...broadcastSupportersGallery,
    ...channelWriterGallery,
    ...broadcastWriterGallery,
    ...draftWriterGallery,
    ...broadcastsOverviewGallery,
    broadcastChannelMark,
    ...copyCountsGallery,
    ...copyStatusGallery,
    broadcastWaiting,
    broadcastView,
    ...broadcastForGallery,
    mailingStanding,
    mailingWhen,
    ...messageCopyViewGallery,
    ...replyActionsGallery,
    unsubscribeForm,
    ...copyReplyGallery,
    ...answerableReplyGallery,
    ...supporterBroadcastsGallery,
    ...textBubbleGallery,
  ],
};
