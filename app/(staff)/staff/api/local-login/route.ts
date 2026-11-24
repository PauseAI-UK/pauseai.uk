import { NextResponse, type NextRequest } from "next/server";
import { loggedIn } from "@/lib/accounts/google-login.server";
import { localLogin, printLoginLink, redeemLoginLink } from "@/lib/accounts/local-login.server";
import { afterLogin, LOGIN_PATH, NEXT_PARAM } from "@/lib/accounts/session";
import { readFormIfAny } from "@/lib/server/json.server";
import { siteUrl } from "@/lib/site-url.server";

// Logging in on a local build without fixtures (lib/accounts/local-login.server.ts).
// Open to anyone, so it doesn't call requireStaff(). The login page's form
// posts an address, and a link is printed in the dev server's terminal;
// the page says to look there, whatever was typed. The link comes back
// here, and logs in once. Anywhere else it doesn't exist: a 404.

export async function POST(request: NextRequest) {
  if (!localLogin()) return new NextResponse(null, { status: 404 });
  const form = await readFormIfAny(request);
  const email = form?.get("email");
  printLoginLink(
    typeof email === "string" ? email.trim().toLowerCase() : "",
    { remember: form?.get("remember") === "on", next: afterLogin(form?.get(NEXT_PARAM)) },
    request,
  );
  return NextResponse.redirect(siteUrl(`${LOGIN_PATH}?printed=1`, request), 303);
}

export async function GET(request: NextRequest) {
  if (!localLogin()) return new NextResponse(null, { status: 404 });
  const link = redeemLoginLink(request.nextUrl.searchParams.get("token") ?? "");
  if (!link) return NextResponse.redirect(siteUrl(`${LOGIN_PATH}?failed=1`, request), 303);
  return loggedIn(request, { email: link.email, name: "" }, link, siteUrl(link.next, request));
}
