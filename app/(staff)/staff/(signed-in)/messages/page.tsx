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
 * Emails and texts to supporters together. A new one starts from the
 * supporters list, as its Consent filter says how it goes and what it's
 * about: New message opens the list saying to add one.
 */
export default async function MessagesPage() {
  await requireStaff("supporters");
  return (
    <>
      <Strip tone="amber">{staffCopy.messagePages.noBackend}</Strip>
      <PageTitle
        intro={staffCopy.messagePages.intro}
        action={
          <ButtonLink variant="primary" fit href="/staff/supporters?why=contact">
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
