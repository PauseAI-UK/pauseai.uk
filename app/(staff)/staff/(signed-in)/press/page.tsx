import type { Metadata } from "next";
import { requireStaff } from "@/lib/accounts/auth.server";
import { pressPage } from "@/lib/press/finds.server";
import {
  addFindNow,
  addPieceNow,
  editFindNow,
  editPieceNow,
  removePieceNow,
  restorePieceNow,
  turnDownFindNow,
} from "../../_components/press/actions";
import { pressPageCopy } from "../../_components/press/copy";
import PressFinds, { AddPiece } from "../../_components/press/PressFinds";
import ExternalLink from "../../_components/ui/ExternalLink";
import Page from "../../_components/ui/Page";
import PageHead from "../../_components/ui/PageHead";

export const metadata: Metadata = { title: pressPageCopy.title };

const { intro } = pressPageCopy;

/** What the press survey found, waiting for staff, the coverage on /press, and what's not on it. */
export default async function PressStaffPage() {
  await requireStaff();
  const page = await pressPage();
  return (
    <Page kind="list">
      <PageHead
        action={<AddPiece act={addPieceNow} />}
        intro={
          <>
            {intro.before}
            <ExternalLink href="/press">/press</ExternalLink>
            {intro.after}
          </>
        }
      >
        {pressPageCopy.title}
      </PageHead>
      <PressFinds
        page={page}
        actions={{
          add: addFindNow,
          turnDown: turnDownFindNow,
          edit: editPieceNow,
          editFind: editFindNow,
          remove: removePieceNow,
          restore: restorePieceNow,
        }}
      />
    </Page>
  );
}
