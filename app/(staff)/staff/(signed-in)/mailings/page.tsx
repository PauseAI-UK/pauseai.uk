import type { Metadata } from "next";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { mailingsPage } from "@/lib/mailings/records";
import { requireStaff } from "@/lib/accounts/auth";
import { newMailing } from "../../_components/mailings/actions";
import MailingsOverview from "../../_components/mailings/MailingsOverview";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";
import { mailingsCopy } from "../../_components/mailings/copy";
import { politiciansCopy } from "../../_components/politicians/copy";

export const metadata: Metadata = { title: mailingsCopy.mailings.title };

export default async function MailingsPage() {
  await requireStaff();
  return (
    <Page kind="month-list">
      <PageHead
        intro={mailingsCopy.mailings.intro}
        action={
          // A new mailing is a draft from the start, with no one ticked, and the list then chooses who it's for.
          <form action={newMailing}>
            <SubmitButton variant="primary" fit>
              {politiciansCopy.choosing.newTitle}
            </SubmitButton>
          </form>
        }
      >
        {mailingsCopy.mailings.title}
      </PageHead>
      <MailingsOverview {...await mailingsPage()} />
    </Page>
  );
}
