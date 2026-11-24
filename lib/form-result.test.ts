import { expect, expectTypeOf, it } from "vitest";
import { refused, type Code, type FormResult, type RefusedFields } from "./form-result";

it("refuses a form with a reason", () => {
  const result: FormResult<"not-found" | "failed", { name: string }> = refused("not-found");
  expect(result).toEqual({ ok: false, reason: "not-found" });
});

it("takes a reason from a fixed set of codes, and never a sentence", () => {
  expectTypeOf<Code<"not-found" | "failed">>().toEqualTypeOf<"not-found" | "failed">();
  expectTypeOf<Code<string>>().toBeNever();
  // @ts-expect-error -- a sentence is plain text, which is no code.
  refused("Postcode not found." as string);
  expectTypeOf<RefusedFields<"invalid", { email: "missing" | "invalid" }>["fields"]>().toEqualTypeOf<{
    email?: "missing" | "invalid";
  }>();
});
