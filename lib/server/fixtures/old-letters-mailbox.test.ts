import { expect, it } from "vitest";
import { oldMailResponse, POLLY_PERSONAL } from "./old-letters-mailbox";

it("finds the mail with one address in it, anywhere, as adding an address to a politician's searches", async () => {
  const found = async (account: string, q: string) =>
    (
      (await oldMailResponse(account, "/messages", new URLSearchParams({ q }))!.json()) as {
        messages: { id: string }[];
      }
    ).messages.map((message) => message.id);
  expect(await found("policy@pauseai.uk", `"${POLLY_PERSONAL}"`)).toEqual(["0b11"]);
  expect(await found("joseph@pauseai.uk", `"${POLLY_PERSONAL}"`)).toEqual([]);
});
