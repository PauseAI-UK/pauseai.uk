import { NextResponse } from "next/server";
import { attachmentHeaders } from "@/lib/mailings/attachments";
import { attachmentFile } from "@/lib/mailings/drafts.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { mailingId } from "@/lib/staff-search";

/** One of a mailing's files: to open in the browser or picture as a thumbnail, if it's a kind that's safe to; else to save (attachmentHeaders). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  await requireStaff();
  const { id, file } = await params;
  const mailing = mailingId(id);
  const attachment = mailing && mailingId(file) ? await attachmentFile(mailing, mailingId(file)!) : undefined;
  if (!attachment) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(attachment.content), { headers: attachmentHeaders(attachment) });
}
