import { NextResponse } from "next/server";
import { attachmentHeaders } from "@/lib/mailings/attachments";
import { attachmentFile } from "@/lib/mailings/drafts";
import { requireStaff } from "@/lib/accounts/auth";
import { mailingId } from "@/lib/staff-search";

/** One of a broadcast's files: to open in the browser or picture as a thumbnail, if it's a kind that's safe to; else to save (attachmentHeaders). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  await requireStaff("supporters");
  const { id, file } = await params;
  const mailing = mailingId(id);
  const attachment =
    mailing && mailingId(file) ? await attachmentFile(mailing, mailingId(file)!, "supporters") : undefined;
  if (!attachment) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(attachment.content), { headers: attachmentHeaders(attachment) });
}
