import { NextResponse } from "next/server";
import { refused } from "@/lib/form-result";
import type { PlaceLookup } from "@/lib/site-events";
import { placeForPostcode } from "@/lib/server/outside-services/postcodes.server";
import { readJsonIfAny } from "@/lib/server/json.server";

/** Where a postcode, or an outcode, is, and its district's name: for the home page's events near it. */
export async function POST(request: Request) {
  const body = ((await readJsonIfAny(request)) ?? null) as { postcode?: unknown } | null;
  const postcode = typeof body?.postcode === "string" ? body.postcode.trim() : "";
  return NextResponse.json<PlaceLookup>(postcode ? await placeForPostcode(postcode) : refused("postcode-required"));
}
