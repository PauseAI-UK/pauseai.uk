import { NextResponse, type NextRequest } from "next/server";
import { TOPICS, type Topic } from "@/lib/contact-permissions";
import { config } from "@/lib/server/config";
import { newSettingsLink, newTopicLink } from "@/lib/server/email-settings";
import { requireStaff } from "@/lib/server/staff-auth";
import { siteUrl } from "@/lib/site-url";

// Development only (DevPreferences): in a fixture build, a supporter's page
// links here for each of their addresses, and for each topic they get by
// email. This makes a fresh link, to the address's contact preferences, or
// with a `topic` to the unsubscribe page of their latest email under it, as
// one of our emails would carry, and goes to it. A link, not a form, so it
// can open in a new tab. Anywhere else it doesn't exist: a 404.
export async function GET(request: NextRequest) {
  await requireStaff("supporters");
  const params = request.nextUrl.searchParams;
  const address = params.get("address");
  const topic = params.get("topic");
  if (!config.fixtures || !address) return new NextResponse(null, { status: 404 });
  if (topic !== null && !TOPICS.includes(topic as Topic)) return new NextResponse(null, { status: 404 });
  const path = topic ? await newTopicLink(address, topic as Topic) : await newSettingsLink(address);
  if (!path) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(siteUrl(path, request), 303);
}
