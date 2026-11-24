import { NextResponse, type NextRequest } from "next/server";
import {
  GOOGLE_LOGIN_COOKIE,
  loggedIn,
  readStarted,
  signLogin,
  type Started,
} from "@/lib/accounts/google-login.server";
import { accountProblems } from "@/lib/accounts/copy";
import { isStaffEmail } from "@/lib/accounts/permissions";
import { GOOGLE_API_PATH, GOOGLE_CALLBACK_PATH, GOOGLE_HANDOFF_PATH, LOGIN_PATH } from "@/lib/accounts/session";
import { googleLoginEmail } from "@/lib/server/outside-services/gmail.server";
import { problem } from "@/lib/server/problems.server";
import { siteUrl } from "@/lib/site-url.server";

/**
 * The address of the account chosen at Google; empty if they went back
 * without choosing; "failed" if the state isn't the one this browser started
 * with, or Google wouldn't say.
 */
async function chosen(request: NextRequest, started: Started | undefined): Promise<string> {
  const params = request.nextUrl.searchParams;
  if (started?.state === undefined || params.get("state") !== started.state) return "failed";
  const code = params.get("code");
  if (!code) return "";
  try {
    return (await googleLoginEmail(code, siteUrl(GOOGLE_CALLBACK_PATH, request).href)) ?? "failed";
  } catch (error) {
    problem(accountProblems.googleLoginFailed(), error);
    return "failed";
  }
}

/** The preview's handoff, with a note signed for it saying `email` logged in; or its login page, if it can't be signed. */
function passedOn(email: string, started: Started & { preview: string }): URL {
  try {
    const handoff = new URL(GOOGLE_HANDOFF_PATH, started.preview);
    handoff.searchParams.set("login", signLogin(email, started.preview, started.nonce!));
    return handoff;
  } catch (error) {
    problem(accountProblems.googleLoginFailed(), error);
    return new URL(`${LOGIN_PATH}?failed=1`, started.preview);
  }
}

/** On to `to`, forgetting the login under way. */
function onTo(to: URL): NextResponse {
  const response = NextResponse.redirect(to, 303);
  response.cookies.delete({ name: GOOGLE_LOGIN_COOKIE, path: GOOGLE_API_PATH });
  return response;
}

// Step two of logging in, on the live site: where Google sends people back
// to, with a code if they chose an account, and the state. Open to anyone,
// so it doesn't call requireStaff(). With the state this browser started
// with and a pauseai.uk account, it logs them in, or, for a preview, signs
// a note saying who it was and passes it on to the preview's handoff
// (lib/accounts/google-login.server.ts). Otherwise it goes back to the
// login page they started from, saying why: `other` for an account that
// isn't pauseai.uk's, `failed` for anything else, and nothing if they went
// back from Google's page without choosing.
export async function GET(request: NextRequest) {
  const started = readStarted(request.cookies.get(GOOGLE_LOGIN_COOKIE)?.value);
  const site = (path: string) => (started?.preview ? new URL(path, started.preview) : siteUrl(path, request));
  const email = await chosen(request, started);
  if (email === "failed") return onTo(site(`${LOGIN_PATH}?failed=1`));
  if (!email) return onTo(site(LOGIN_PATH));
  if (!isStaffEmail(email)) return onTo(site(`${LOGIN_PATH}?other=1`));
  const { preview } = started!;
  if (preview) return onTo(passedOn(email, { ...started!, preview }));
  return loggedIn(request, email, started!, siteUrl(started!.next, request));
}
