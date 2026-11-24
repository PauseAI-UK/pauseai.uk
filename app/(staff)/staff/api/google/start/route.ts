import { NextResponse, type NextRequest } from "next/server";
import {
  goesToGoogle,
  isPreviewOrigin,
  LIVE_ORIGIN,
  newSecret,
  startedCookie,
} from "@/lib/accounts/google-login.server";
import {
  afterLogin,
  FIXTURE_GOOGLE_ACCOUNT_COOKIE,
  GOOGLE_CALLBACK_PATH,
  GOOGLE_START_PATH,
  LOGIN_PATH,
  NEXT_PARAM,
} from "@/lib/accounts/session";
import { googleLoginUrl } from "@/lib/server/outside-services/gmail.server";
import { siteUrl } from "@/lib/site-url.server";

// Step one of logging in, from the login page's button, with "Keep me
// signed in" (`remember`) and the page to go to (`next`). Open to anyone, so
// it doesn't call requireStaff(). The live site goes to Google's page to
// choose an account, keeping a random state in a cookie, to check Google
// comes back to this browser. A preview goes to the live site's start
// instead, with its own address and a nonce it keeps, for the live site to
// pass the login back to (lib/accounts/google-login.server.ts). The live
// site goes to Google for a preview only, and only with a nonce.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const remember = params.get("remember") === "on";
  const next = afterLogin(params.get(NEXT_PARAM));
  if (!goesToGoogle()) {
    const nonce = newSecret();
    const live = new URL(GOOGLE_START_PATH, LIVE_ORIGIN);
    live.search = new URLSearchParams({ preview: siteUrl("/", request).origin, nonce }).toString();
    const response = NextResponse.redirect(live, 303);
    response.cookies.set(startedCookie({ nonce, remember, next }));
    return response;
  }
  const preview = params.get("preview") ?? undefined;
  const nonce = params.get("nonce") ?? undefined;
  if (preview !== undefined && !(isPreviewOrigin(preview) && nonce)) {
    return NextResponse.redirect(siteUrl(`${LOGIN_PATH}?failed=1`, request), 303);
  }
  const state = newSecret();
  const response = NextResponse.redirect(
    googleLoginUrl(
      siteUrl(GOOGLE_CALLBACK_PATH, request).href,
      state,
      request.cookies.get(FIXTURE_GOOGLE_ACCOUNT_COOKIE)?.value,
    ),
    303,
  );
  response.cookies.set(startedCookie({ state, preview, nonce, remember, next }));
  return response;
}
