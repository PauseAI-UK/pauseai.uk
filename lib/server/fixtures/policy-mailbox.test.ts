import { expect, it } from "vitest";
import { POLLY_PERSONAL, policyMailResponse } from "./policy-mailbox";

const get = async (account: string, path: string, params: Record<string, string | string[]> = {}) => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) for (const v of [value].flat()) search.append(name, v);
  return policyMailResponse(account, path, search)?.json();
};

it("finds the mail with one address in it, as adding an address to a politician's searches, and nothing else", async () => {
  const found = async (account: string, q: string) =>
    ((await get(account, "/messages", { q })) as { messages: { id: string }[] }).messages.map((m) => m.id);
  expect(await found("policy@pauseai.uk", `"${POLLY_PERSONAL}"`)).toEqual(["0b11"]);
  expect(await found("joseph@pauseai.uk", `"${POLLY_PERSONAL}"`)).toEqual([]);
  expect(await found("policy@pauseai.uk", "newer_than:3d")).toEqual([]);
});

it("lists a thread, and gives a message whole, as its text, or as the headers asked for", async () => {
  expect(await get("policy@pauseai.uk", "/threads/t-stray")).toEqual({ messages: [{ id: "0b02" }] });
  const raw = await get("policy@pauseai.uk", "/messages/0b02", { format: "raw" });
  expect(Buffer.from(raw.raw, "base64url").toString()).toContain("Subject: Are you hiring?");
  const full = await get("policy@pauseai.uk", "/messages/0b02", { format: "full" });
  expect(Buffer.from(full.payload.body.data, "base64url").toString()).toBe("Are you?");
  const metadata = await get("policy@pauseai.uk", "/messages/0b02", { metadataHeaders: ["subject", "From"] });
  expect(metadata.payload.headers.map((h: { name: string }) => h.name)).toEqual(["From", "Subject"]);
  expect(metadata.internalDate).toBe(String(Date.parse("2026-10-31T09:00:00.000Z")));
});

it("answers nothing for a message it hasn't, or another account", async () => {
  expect(await get("policy@pauseai.uk", "/messages/nope")).toBeUndefined();
  expect(await get("jo@pauseai.uk", "/messages")).toBeUndefined();
});
