import { expect, it } from "vitest";
import { fieldText, parseJsonIfAny, readFormIfAny, readJsonIfAny } from "./json.server";

it("parses JSON, and says undefined for anything else", async () => {
  expect(parseJsonIfAny('{"a":1}')).toEqual({ a: 1 });
  expect(parseJsonIfAny("null")).toBeNull();
  expect(parseJsonIfAny("")).toBeUndefined();
  expect(parseJsonIfAny("<html>")).toBeUndefined();
  expect(await readJsonIfAny(new Response('{"error":{"message":"Too many"}}'))).toEqual({
    error: { message: "Too many" },
  });
  expect(await readJsonIfAny(new Response("not json", { status: 502 }))).toBeUndefined();
  expect(await readJsonIfAny(new Request("https://pauseai.uk/x", { method: "POST", body: "[1]" }))).toEqual([1]);
});

it("reads a posted form, and says undefined for a body that isn't one", async () => {
  const posted = (body: BodyInit, type: string) =>
    new Request("https://pauseai.uk/x", { method: "POST", body, headers: { "content-type": type } });
  const form = await readFormIfAny(posted("email=jo%40pauseai.uk", "application/x-www-form-urlencoded"));
  expect(form?.get("email")).toBe("jo@pauseai.uk");
  expect(await readFormIfAny(posted("{}", "application/json"))).toBeUndefined();
});

it("says a field's text or number, and nothing for anything else", () => {
  expect(fieldText("invalid_grant")).toBe("invalid_grant");
  expect(fieldText(406)).toBe("406");
  expect([undefined, null, { a: 1 }, ["x"], true].map(fieldText)).toEqual(["", "", "", "", ""]);
});
