import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/server/config";
import { newCopyLink, newSettingsLink } from "@/lib/server/email-settings";
import { requireStaff } from "@/lib/server/staff-auth";
import { siteUrl } from "@/lib/site-url";

// Development only (DevPreferences): in a fixture build, a supporter's page
// links here for each of their addresses, and for a copy of each kind of
// broadcast email they were sent. This makes a fresh link, to the address's
// contact preferences (`address`) or the copy's unsubscribe page (`copy`),
// as one of our emails would carry, and goes to it. A link, not a form, so
// it can open in a new tab. Anywhere else it doesn't exist: a 404.
export async function GET(request: NextRequest) {
  await requireStaff("supporters");
  const params = request.nextUrl.searchParams;
  const address = params.get("address");
  const copy = Number(params.get("copy"));
  if (!config.fixtures) return new NextResponse(null, { status: 404 });
  const path = address ? await newSettingsLink(address) : copy ? await newCopyLink(copy) : undefined;
  if (!path) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(siteUrl(path, request), 303);
}
