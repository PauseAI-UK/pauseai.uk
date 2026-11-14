import type { Metadata } from "next";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { staffCopy } from "@/lib/content/staff-interface";
import { mailingsPage } from "@/lib/server/mailings";
import { requireStaff } from "@/lib/accounts/auth";
import { newMailing } from "../../mailing-actions";
import MailingsOverview from "../../_components/MailingsOverview";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";

export const metadata: Metadata = { title: staffCopy.mailings.title };

export default async function MailingsPage() {
  await requireStaff();
  return (
    <Page kind="month-list">
      <PageHead
        intro={staffCopy.mailings.intro}
        action={
          // A new mailing is a draft from the start, with no one ticked, and the list then chooses who it's for.
          <form action={newMailing}>
            <SubmitButton variant="primary" fit>
              {staffCopy.mailingPages.newTitle}
            </SubmitButton>
          </form>
        }
      >
        {staffCopy.mailings.title}
      </PageHead>
      <MailingsOverview {...await mailingsPage()} />
    </Page>
  );
}
