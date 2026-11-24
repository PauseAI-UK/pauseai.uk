import { afterEach, describe, expect, it, vi } from "vitest";
import { localLogin, printLoginLink, redeemLoginLink } from "./local-login.server";

const NOW = Date.parse("2026-11-24T12:00:00Z");
const REQUEST = new Request("http://localhost:3000/staff/api/local-login");

/** Prints a link for `email` and returns its token, from what was printed. */
function printed(email: string, now = NOW): string | undefined {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  printLoginLink(email, { remember: true, next: "/staff/letters" }, REQUEST, now);
  const line = String(info.mock.calls.at(-1)?.[0] ?? "");
  info.mockRestore();
  return line.match(/token=([\w-]+)$/)?.[1];
}

afterEach(() => vi.unstubAllEnvs());

describe("logging in on a local build", () => {
  it("is only for a local build without fixtures", () => {
    vi.stubEnv("DEPLOY_CONTEXT", "local");
    vi.stubEnv("DATA_FIXTURES", "");
    expect(localLogin()).toBe(true);
    vi.stubEnv("DATA_FIXTURES", "1");
    expect(localLogin()).toBe(false);
    vi.stubEnv("DATA_FIXTURES", "");
    for (const context of ["production", "deploy-preview", "branch-deploy"]) {
      vi.stubEnv("DEPLOY_CONTEXT", context);
      expect(localLogin(), context).toBe(false);
    }
  });

  it("prints a link on this build that logs in once, as asked", () => {
    vi.stubEnv("DEPLOY_CONTEXT", "local");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    printLoginLink("jo@pauseai.uk", { remember: true, next: "/staff/letters" }, REQUEST, NOW);
    expect(info.mock.calls[0][0]).toMatch(
      /^Log in as jo@pauseai\.uk: http:\/\/localhost:3000\/staff\/api\/local-login\?token=[\w-]{43}$/,
    );
    info.mockRestore();
    const token = printed("jo@pauseai.uk")!;
    expect(redeemLoginLink(token, NOW + 60_000)).toEqual({
      email: "jo@pauseai.uk",
      remember: true,
      next: "/staff/letters",
    });
    expect(redeemLoginLink(token, NOW + 60_000)).toBeUndefined();
  });

  it("lasts 15 minutes", () => {
    vi.stubEnv("DEPLOY_CONTEXT", "local");
    const token = printed("jo@pauseai.uk")!;
    expect(redeemLoginLink(token, NOW + 15 * 60_000)).toBeUndefined();
    expect(redeemLoginLink(printed("jo@pauseai.uk", Date.now())!)).toBeDefined();
  });

  it("prints none for an address outside pauseai.uk, and knows no other token", () => {
    vi.stubEnv("DEPLOY_CONTEXT", "local");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    printLoginLink("sam@gmail.com", { remember: false, next: "/staff" }, REQUEST, NOW);
    expect(info).toHaveBeenCalledWith("No login link: sam@gmail.com isn't a pauseai.uk address");
    info.mockRestore();
    expect(redeemLoginLink("made-up")).toBeUndefined();
  });
});
