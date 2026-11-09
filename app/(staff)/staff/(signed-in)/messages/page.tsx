import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { staffCopy } from "@/lib/content/staff-interface";
import { messagesPage } from "@/lib/server/message-pages";
import { requireStaff } from "@/lib/server/staff-auth";
import MessagesOverview from "../../_components/MessagesOverview";
import PageTitle from "../../_components/ui/PageTitle";
import Strip from "../../_components/ui/Strip";

export const metadata: Metadata = { title: staffCopy.messagePages.title };

/**
 * Broadcasts, emails and texts to supporters, together. New broadcast asks
 * which Consent it goes under, as that says how it goes and what it's about.
 */
export default async function MessagesPage() {
  await requireStaff("supporters");
  return (
    <>
      <Strip tone="amber">{staffCopy.messagePages.noBackend}</Strip>
      <PageTitle
        intro={staffCopy.messagePages.intro}
        action={
          <ButtonLink variant="primary" fit href="/staff/messages/new">
            {staffCopy.messagePages.newMessage}
          </ButtonLink>
        }
      >
        {staffCopy.messagePages.title}
      </PageTitle>
      <MessagesOverview {...await messagesPage()} />
    </>
  );
}
