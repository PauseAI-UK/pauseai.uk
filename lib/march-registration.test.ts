import { describe, expect, it } from "vitest";
import { checkMarchRegistration } from "./march-registration";
import { marchSignupCopy } from "@/lib/content/march-signup";

const valid = { name: "Testy McTestface", email: "testy@example.org" };
const blank = { phone: null, city: null, postcode: null, consent: false, utmSource: null };

describe("checkMarchRegistration", () => {
  it("takes a name and an email, trimmed, and the optional fields as given", () => {
    const result = checkMarchRegistration({
      name: "  Testy McTestface ",
      email: " testy@example.org ",
      phone: " 07700 900000 ",
      city: "Leeds",
      postcode: "sw1a 0aa",
      consent: true,
      utmSource: "nl",
      website: "",
    });
    expect(result).toEqual({
      ok: true,
      registration: {
        ...valid,
        phone: "+447700900000",
        city: "Leeds",
        postcode: "SW1A 0AA",
        consent: true,
        utmSource: "nl",
      },
    });
  });

  it("takes a blank optional field, or one it won't keep, as none, and only true as agreeing", () => {
    expect(checkMarchRegistration({ ...valid, phone: " ", city: "", consent: "on" })).toEqual({
      ok: true,
      registration: { ...valid, ...blank },
    });
    for (const odd of ["x".repeat(101), "Lee\nds", 7]) {
      expect(checkMarchRegistration({ ...valid, city: odd, postcode: odd, utmSource: odd }), String(odd)).toEqual({
        ok: true,
        registration: { ...valid, ...blank },
      });
    }
  });

  it("asks for each field that's missing", () => {
    expect(checkMarchRegistration({ name: " ", email: "" })).toEqual({
      ok: false,
      errors: {
        name: "Please enter your full name.",
        email: "Please enter your email address.",
      },
    });
  });

  it("treats anything but an object of strings as missing", () => {
    expect(checkMarchRegistration(null).ok).toBe(false);
    expect(checkMarchRegistration({ name: [], email: {} }).ok).toBe(false);
  });

  it("refuses a name that's too long or has control characters in it", () => {
    for (const name of ["x".repeat(101), "Testy\nMcTestface"]) {
      expect(checkMarchRegistration({ ...valid, name }), name).toEqual({
        ok: false,
        errors: { name: "Please check your full name." },
      });
    }
  });

  it("refuses a phone number it can't read in international format, saying how to write one", () => {
    for (const phone of ["7700900000", "0770?900000", "+", "call me", 7]) {
      expect(checkMarchRegistration({ ...valid, phone }), String(phone)).toEqual(
        phone === 7
          ? { ok: true, registration: { ...valid, ...blank } }
          : { ok: false, errors: { phone: marchSignupCopy.errors.phoneInvalid } },
      );
    }
  });

  it("refuses an email that isn't one", () => {
    for (const email of [
      "testy",
      "testy@example",
      "tes ty@example.org",
      "a@b@c.org",
      `${"a".repeat(250)}@x.org`,
      "te\u0007sty@example.org",
    ]) {
      expect(checkMarchRegistration({ ...valid, email }), email).toEqual({
        ok: false,
        errors: { email: "Please enter a valid email address." },
      });
    }
  });
});
