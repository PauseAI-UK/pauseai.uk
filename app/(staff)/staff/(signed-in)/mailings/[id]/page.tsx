import type { Metadata } from "next";
import { found } from "@/lib/found";
import { mailingPageData } from "@/lib/mailings/pages.server";
import { mailingCrumb, mailingTitle } from "@/lib/mailings/records.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { mailingId } from "@/lib/staff-search";
import { type ParamValue } from "@/lib/list-params";
import MailingFor from "../../../_components/mailings/MailingFor";
import Page from "../../../_components/ui/Page";
import {
  attachToMailing,
  deleteMailingDraft,
  detachFromMailing,
  rescheduleMailingNow,
  saveMailing,
  scheduleMailingNow,
  sendMailingTest,
  stopMailingNow,
} from "../../../_components/mailings/actions";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: ParamValue; tab?: ParamValue }>;
};

export async function generateMetadata({ params }: Pick<Params, "params">): Promise<Metadata> {
  await requireStaff();
  return { title: found(await mailingTitle(found(mailingId((await params).id)))) };
}

/** A mailing: one imported, with a page of its recipients; a draft, to write; or one scheduled or sent. */
export default async function MailingPage({ params, searchParams }: Params) {
  const { email } = await requireStaff();
  const id = found(mailingId((await params).id));
  const [data, here] = await Promise.all([mailingPageData(id, await searchParams, email), mailingCrumb(id)]);
  return (
    <Page kind="record" under="mailings" here={found(here)}>
      <MailingFor
        data={found(data)}
        actions={{
          save: saveMailing,
          attach: attachToMailing,
          detach: detachFromMailing,
          sendTest: sendMailingTest,
          schedule: scheduleMailingNow,
          deleteDraft: deleteMailingDraft,
          stop: stopMailingNow,
          reschedule: rescheduleMailingNow,
        }}
      />
    </Page>
  );
}
