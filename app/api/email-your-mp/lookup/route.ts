import { NextResponse } from "next/server";
import { copy } from "@/lib/content/email-your-mp";
import { findMp } from "@/lib/politicians/find-mp.server";
import { statusesOf } from "@/lib/politicians/records.server";
import { readJsonIfAny } from "@/lib/server/json.server";

const MESSAGES = {
  not_found: copy.lookup.notFound,
  no_constituency: copy.lookup.noConstituency,
  no_mp: copy.lookup.noMp,
  failed: copy.lookup.failed,
};

/** The MP for a postcode, what they've done for each campaign, and where the postcode is, if known. */
export async function POST(request: Request) {
  const body = ((await readJsonIfAny(request)) ?? null) as { postcode?: unknown } | null;
  const postcode = typeof body?.postcode === "string" ? body.postcode.trim() : "";
  if (!postcode) return NextResponse.json({ ok: false, message: copy.lookup.postcodeRequired }, { status: 400 });

  const found = await findMp(postcode);
  if (!found.ok) return NextResponse.json({ ok: false, message: MESSAGES[found.reason] });
  const { mp } = found;
  return NextResponse.json({
    ok: true,
    // An address that bounced can still be written to: the letter waits until it works (lib/letters/sending.server.ts).
    mp,
    statuses: await statusesOf(mp.id),
    place: found.place ?? null,
  });
}
