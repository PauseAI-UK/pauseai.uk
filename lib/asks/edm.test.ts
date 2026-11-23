import { expect, it } from "vitest";
import { EDM_ANSWER } from "@/lib/server/fixtures/politician-lists";
import { edmSigners } from "./edm";

it("reads each signer's ID, name and day, leaving out those who withdrew", () => {
  expect(edmSigners(EDM_ANSWER)).toEqual([
    { id: 90002, name: "Polly Placeholder", date: "2026-11-09" },
    { id: 90003, name: "Mo Example", date: "2026-11-11" },
  ]);
});

it("takes a signer without a name", () => {
  expect(
    edmSigners({ Response: { Sponsors: [{ MemberId: 1, Member: null, CreatedWhen: "2026-11-09T09:00:00" }] } }),
  ).toEqual([{ id: 1, name: "", date: "2026-11-09" }]);
});

it("throws on an answer with no list of signers, as its shape has changed", () => {
  expect(() => edmSigners(null)).toThrow("No signers");
  expect(() => edmSigners({ Response: {} })).toThrow("has its answer changed shape?");
});
