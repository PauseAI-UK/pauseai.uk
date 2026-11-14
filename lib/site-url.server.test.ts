import { afterEach, expect, it, vi } from "vitest";
import { requestHeaders } from "@/tests/next-headers";
import { actionRequest, siteUrl } from "./site-url.server";

vi.mock("next/headers", () => import("@/tests/next-headers"));

afterEach(() => vi.unstubAllEnvs());

const request = new Request("https://main--pauseaiuk.netlify.app/staff/api/callback?token=t");

it("builds URLs on the deploy's own origin, not the request's, which on Netlify is netlify.app", () => {
  vi.stubEnv("SITE_ORIGIN", "https://pauseai.uk");
  expect(siteUrl("/staff/login?sent=1", request).href).toBe("https://pauseai.uk/staff/login?sent=1");
});

it("uses the request's origin only in a local build, and otherwise refuses to guess", () => {
  vi.stubEnv("SITE_ORIGIN", "");
  vi.stubEnv("DEPLOY_CONTEXT", "local");
  expect(siteUrl("/staff", new Request("http://localhost:3000/staff/api/login")).href).toBe(
    "http://localhost:3000/staff",
  );
  expect(() => siteUrl("/staff", undefined)).toThrow("SITE_ORIGIN isn't set");
  vi.stubEnv("DEPLOY_CONTEXT", "production");
  expect(() => siteUrl("/staff", request)).toThrow("SITE_ORIGIN isn't set");
});

it("stands in a request for a Server Action on a local build, at its Host, and nowhere else", async () => {
  vi.stubEnv("SITE_ORIGIN", "");
  vi.stubEnv("DEPLOY_CONTEXT", "local");
  requestHeaders.delete("host");
  expect(await actionRequest()).toBeUndefined();
  requestHeaders.set("host", "localhost:3001");
  expect(siteUrl("/contact-preferences/t", await actionRequest()).href).toBe(
    "http://localhost:3001/contact-preferences/t",
  );
  vi.stubEnv("DEPLOY_CONTEXT", "production");
  expect(await actionRequest()).toBeUndefined();
  requestHeaders.delete("host");
});
