import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/server/config";
import { newSettingsLink } from "@/lib/server/email-settings";
import { requireStaff } from "@/lib/server/staff-auth";
import { siteUrl } from "@/lib/site-url";

// Development only (DevPreferences): in a fixture build, a supporter's page
// links here for each of their addresses, and this makes a fresh link to
// that address's contact preferences, as one of our emails would carry, and
// goes to it. A link, not a form, so it can open in a new tab. Anywhere
// else it doesn't exist: a 404.
export async function GET(request: NextRequest) {
  await requireStaff("supporters");
  const address = request.nextUrl.searchParams.get("address");
  if (!config.fixtures || !address) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(siteUrl(await newSettingsLink(address), request), 303);
}
