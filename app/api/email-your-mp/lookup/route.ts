import { NextResponse } from "next/server";
import type { MpLookup } from "@/lib/email-your-mp";
import { refused } from "@/lib/form-result";
import { findMp } from "@/lib/politicians/find-mp.server";
import { statusesOf } from "@/lib/politicians/records.server";
import { readJsonIfAny } from "@/lib/server/json.server";

/** The MP for a postcode, what they've done for each campaign, and where the postcode is, if known. */
export async function POST(request: Request) {
  const body = ((await readJsonIfAny(request)) ?? null) as { postcode?: unknown } | null;
  const postcode = typeof body?.postcode === "string" ? body.postcode.trim() : "";
  if (!postcode) return NextResponse.json<MpLookup>(refused("postcode-required"));

  const found = await findMp(postcode);
  if (!found.ok) return NextResponse.json<MpLookup>(found);
  const { mp } = found;
  return NextResponse.json<MpLookup>({
    ok: true,
    // An address that bounced can still be written to: the letter waits until it works (lib/letters/sending.server.ts).
    mp,
    statuses: await statusesOf(mp.id),
    place: found.place ?? null,
  });
}
