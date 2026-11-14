import { NextResponse, type NextRequest } from "next/server";
import { TOPICS, type Topic } from "@/lib/supporters/contact-permissions";
import { config } from "@/lib/server/config";
import { newSettingsLink, newTopicLink } from "@/lib/supporters/email-settings";
import { requireStaff } from "@/lib/accounts/auth";
import { siteUrl } from "@/lib/site-url";

// Development only (DevPreferences): in a fixture build, a supporter's page
// links here for each of their addresses, and for each topic they get by
// email, and for an email past the days its page works for. This makes a
// fresh link, to the address's contact preferences, or with a `topic` to the
// unsubscribe page of their latest email under it (`old`: an email that
// old), as one of our emails would carry, and goes to it. A link, not a form, so it
// can open in a new tab. Anywhere else it doesn't exist: a 404.
export async function GET(request: NextRequest) {
  await requireStaff("supporters");
  const params = request.nextUrl.searchParams;
  const address = params.get("address");
  const topic = params.get("topic");
  if (!config.fixtures || !address) return new NextResponse(null, { status: 404 });
  if (topic !== null && !TOPICS.includes(topic as Topic)) return new NextResponse(null, { status: 404 });
  const old = params.get("old") === "1";
  const path = topic ? await newTopicLink(address, topic as Topic, old) : await newSettingsLink(address);
  return path ? NextResponse.redirect(siteUrl(path, request), 303) : new NextResponse(null, { status: 404 });
}
