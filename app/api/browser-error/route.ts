import { NextResponse } from "next/server";
import { browserReport, keepBrowserError } from "@/lib/server/errors-seen";
import { parseJsonIfAny } from "@/lib/server/json";

// Receives an error from a visitor's browser (lib/browser-errors.ts), and
// keeps it beside the server's own (lib/server/errors-seen.ts). Anyone can
// post anything here, so: only a page of the site's own may (the browser
// says so, in Sec-Fetch-Site, which a script on another site can't set); the
// body is capped before it's parsed; every field is checked and cut short
// before it's kept; and only so many new errors are kept in an hour.

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: Request) {
  // Always 204: the browser has nothing to do with any other answer.
  const done = new NextResponse(null, { status: 204 });
  if (request.headers.get("sec-fetch-site") !== "same-origin") return done;
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return done;
  const report = browserReport(parseJsonIfAny(body));
  if (report) await keepBrowserError(report, request.headers.get("user-agent"));
  return done;
}
