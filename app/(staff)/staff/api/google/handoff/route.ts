import { NextResponse, type NextRequest } from "next/server";
import { GOOGLE_LOGIN_COOKIE, loggedIn, readLogin, readStarted } from "@/lib/accounts/google-login.server";
import { GOOGLE_API_PATH, LOGIN_PATH } from "@/lib/accounts/session";
import { siteUrl } from "@/lib/site-url.server";

// Step three of logging in, on a deploy preview: where the live site passes
// on a login, with a note it signed saying who logged in
// (lib/accounts/google-login.server.ts). Open to anyone, so it doesn't call
// requireStaff(). With a note the live site signed for this preview and the
// nonce in this browser's cookie, still current, it logs them in in this
// preview's database. The live site has checked the address is pauseai.uk's.
// Otherwise it goes back to the login page, saying it failed.
export async function GET(request: NextRequest) {
  const started = readStarted(request.cookies.get(GOOGLE_LOGIN_COOKIE)?.value);
  const note = request.nextUrl.searchParams.get("login") ?? "";
  const account = started?.nonce ? readLogin(note, siteUrl("/", request).origin, started.nonce) : undefined;
  if (!account) {
    const response = NextResponse.redirect(siteUrl(`${LOGIN_PATH}?failed=1`, request), 303);
    response.cookies.delete({ name: GOOGLE_LOGIN_COOKIE, path: GOOGLE_API_PATH });
    return response;
  }
  return loggedIn(request, account, started!, siteUrl(started!.next, request));
}
