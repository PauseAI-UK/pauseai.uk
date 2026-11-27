import { NextResponse } from "next/server";
import { writeLinkPath } from "@/lib/broadcasts/write-links.server";
import { siteUrl } from "@/lib/site-url.server";

// A broadcast's link to write to their MP in a campaign
// (lib/broadcasts/write-links.server.ts): on to the campaign's page, with the
// reader's name and postcode filled in where the link's token finds them.

type Params = { params: Promise<{ token: string; slug: string }> };

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const { token, slug } = await params;
  return NextResponse.redirect(siteUrl(await writeLinkPath(token, slug), request), 303);
}
