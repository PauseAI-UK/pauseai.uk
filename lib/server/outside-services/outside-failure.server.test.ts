import { expect, it } from "vitest";
import { describeError } from "@/lib/server/problems.server";
import { kindOfStatus, notSet, OutsideFailure, outsideJson, refusal, retryAfterOf } from "./outside-failure.server";

it("says what kind of failure a status is, by itself", () => {
  expect([429, 401, 403, 404, 400, 500, 503].map(kindOfStatus)).toEqual([
    "rate-limited",
    "unauthorised",
    "unauthorised",
    "not-found",
    "refused",
    "refused",
    "refused",
  ]);
});

it("reads the seconds to wait from Retry-After, when the answer says", () => {
  const answer = (after?: string) =>
    new Response(null, { status: 429, headers: after === undefined ? {} : { "retry-after": after } });
  expect(retryAfterOf(answer("30"))).toBe(30);
  expect(retryAfterOf(answer())).toBeUndefined();
  expect(retryAfterOf(answer(""))).toBeUndefined();
  expect(retryAfterOf(answer("Wed, 21 Oct 2026 07:28:00 GMT"))).toBeUndefined();
});

it("writes a failure's words from its parts, whichever service it was", () => {
  expect(new OutsideFailure("luma", "unreachable").message).toBe("Luma couldn't be reached");
  expect(new OutsideFailure("gmail", "timeout").message).toBe("Gmail didn't answer in time");
  expect(new OutsideFailure("postmark", "refused", { status: 422, said: "Bad address" }).message).toBe(
    "Postmark answered 422: Bad address",
  );
  expect(new OutsideFailure("civicrm", "refused", { said: "Not a list" }).message).toBe("CiviCRM refused: Not a list");
  expect(new OutsideFailure("stripe", "refused").message).toBe("Stripe refused");
  expect(
    new OutsideFailure("luma", "not-found", { status: 404, asked: "/v1/event/get", said: "No event" }).message,
  ).toBe("Luma answered 404 for /v1/event/get: No event");
  expect(new OutsideFailure("stripe", "refused", { status: 500, message: "In its own words" }).message).toBe(
    "In its own words",
  );
});

it("has the same fields whichever service failed, with no answer's status as 0", () => {
  const cause = new TypeError("fetch failed");
  const failed = new OutsideFailure("whatsapp", "rate-limited", {
    status: 429,
    serviceCode: 130429,
    said: "x".repeat(600),
    retryAfter: 60,
    cause,
  });
  expect(failed).toBeInstanceOf(Error);
  expect(failed).toMatchObject({
    name: "OutsideFailure",
    service: "whatsapp",
    kind: "rate-limited",
    status: 429,
    serviceCode: 130429,
    retryAfter: 60,
    cause,
  });
  expect(failed.said).toHaveLength(500);
  expect(new OutsideFailure("luma", "unreachable", { cause })).toMatchObject({ status: 0, said: undefined });
  expect(describeError(new OutsideFailure("luma", "unreachable", { cause }))).toBe(
    "Luma couldn't be reached (fetch failed)",
  );
  class LumaFailure extends OutsideFailure {}
  expect(new LumaFailure("luma", "refused").name).toBe("LumaFailure");
});

it("makes the failure for an answer that isn't ok, and for a key that isn't set", () => {
  const answer = new Response(null, { status: 429, headers: { "retry-after": "12" } });
  expect(refusal("parliament", answer)).toMatchObject({
    service: "parliament",
    kind: "rate-limited",
    status: 429,
    retryAfter: 12,
    message: "Parliament answered 429",
  });
  expect(refusal("luma", new Response(null, { status: 400 }), { said: "No such contact" })).toMatchObject({
    kind: "refused",
    said: "No such contact",
    message: "Luma answered 400: No such contact",
  });
  expect(notSet("luma", "LUMA_API_KEY")).toMatchObject({
    service: "luma",
    kind: "unauthorised",
    status: 0,
    message: "LUMA_API_KEY is not set",
  });
});

it("reads a body as JSON, and says a service whose body isn't has failed", async () => {
  expect(await outsideJson("stripe", Response.json({ data: [] }))).toEqual({ data: [] });
  const failed = await outsideJson("stripe", new Response("<html>Bad gateway</html>", { status: 200 })).catch(
    (error: unknown) => error,
  );
  expect(failed).toBeInstanceOf(OutsideFailure);
  expect(failed).toMatchObject({
    service: "stripe",
    kind: "refused",
    status: 200,
    message: "Stripe answered 200 with a body that isn't JSON",
  });
});
