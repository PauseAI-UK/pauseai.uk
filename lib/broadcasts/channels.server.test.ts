import { afterEach, expect, it, onTestFinished, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import {
  channelSends,
  NUMBER_KEPT_MS,
  textBackend,
  textSenderNumber,
  whatsAppKeys,
  forgetNumbers,
} from "./channels.server";

// Each test sets Meta's answers its own way, so none sees our number as another's Meta said it.
afterEach(() => {
  vi.unstubAllEnvs();
  forgetNumbers();
});

/** WhatsApp's keys set, as on the live site. */
function keysSet() {
  vi.stubEnv("WHATSAPP_TOKEN", "token");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
}

it("sends no text where WhatsApp's keys aren't set, as on a deploy preview", async () => {
  vi.stubEnv("DATA_FIXTURES", "");
  vi.stubEnv("WHATSAPP_TOKEN", "");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
  expect(whatsAppKeys()).toBeUndefined();
  expect(channelSends("text")).toBe(false);
  expect(await textBackend()).toBeUndefined();
  expect(await textSenderNumber()).toBeNull();
});

it("uses the fake's keys in a fixture build where none are set, as the dev server", () => {
  vi.stubEnv("DATA_FIXTURES", "1");
  vi.stubEnv("WHATSAPP_TOKEN", "");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "");
  expect(whatsAppKeys()).toEqual({ token: "fixture", accountId: "fixture-account" });
  expect(channelSends("text")).toBe(true);
});

it("sends texts by WhatsApp from our number there, where its keys are set", async () => {
  keysSet();
  expect(channelSends("text")).toBe(true);
  expect(await textBackend()).toEqual({
    keys: { token: "token", accountId: "fixture-account" },
    number: { id: "fixture-phone", number: "+447700900000", dailyLimit: 250 },
  });
  expect(await textSenderNumber()).toBe("+447700900000");
});

it("sends no text, reporting it, while WhatsApp doesn't answer", async () => {
  keysSet();
  vi.spyOn(console, "error").mockImplementation(() => {});
  server.use(
    http.get(/graph\.facebook\.com/, () => HttpResponse.json({ error: { message: "Down" } }, { status: 500 })),
  );
  expect(await textBackend()).toBeUndefined();
  expect(console.error).toHaveBeenCalled();
});

it("asks Meta for our number once in a while, those asking at once sharing the question, and again once it fails", async () => {
  keysSet();
  vi.spyOn(console, "error").mockImplementation(() => {});
  let asked = 0;
  let down = false;
  server.use(
    http.get(/graph\.facebook\.com\/.*phone_numbers/, () => {
      asked++;
      return down
        ? HttpResponse.json({ error: { message: "Down" } }, { status: 500 })
        : HttpResponse.json({ data: [{ id: "fixture-phone", display_phone_number: "+44 7700 900000" }] });
    }),
  );
  vi.useFakeTimers({ toFake: ["Date"] });
  onTestFinished(() => void vi.useRealTimers());
  // Asked by the page's parts at once: one question.
  await Promise.all([textSenderNumber(), textSenderNumber(), textBackend()]);
  expect(asked).toBe(1);
  // Kept a while: no question.
  vi.advanceTimersByTime(NUMBER_KEPT_MS - 1);
  expect(await textSenderNumber()).toBe("+447700900000");
  expect(asked).toBe(1);
  // Then asked again, and Meta doesn't answer: none kept, so the next asks once more.
  vi.advanceTimersByTime(1);
  down = true;
  expect(await textSenderNumber()).toBeNull();
  down = false;
  expect(await textSenderNumber()).toBe("+447700900000");
  expect(asked).toBe(3);
});

it("says whether an email can go by what it's sent by", () => {
  expect(channelSends("email")).toBe(true);
  expect(channelSends("email", "gmail")).toBe(true);
});
