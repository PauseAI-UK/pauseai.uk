// Checking what the march sign-up form sends (app/api/march/register/route.ts).
// It runs on the server, where it counts: the browser's `required` and
// type="email" are only a convenience, and the route can be posted to
// directly.
import type { Refused, RefusedFields } from "@/lib/form-result";
import { phoneNumber, type PhoneNumber } from "@/lib/phone";

/**
 * A sign-up: the name and email Luma gets, and what else the form asks,
 * kept as a form entry. An optional field left blank is null.
 */
export type MarchRegistration = {
  name: string;
  email: string;
  phone: PhoneNumber | null;
  city: string | null;
  postcode: string | null;
  /** The box to hear from us by email and phone. */
  consent: boolean;
  /** The page's utm_source, where the link they followed came from. */
  utmSource: string | null;
};

/** What can be wrong with each field the form checks: the form says each in its own words. */
export type MarchFieldsWrong = { name: "missing" | "check"; email: "missing" | "invalid"; phone: "invalid" };

/** A sign-up the form can't take, with what's wrong with each field. */
export type MarchInvalid = RefusedFields<"invalid", MarchFieldsWrong>;

export type MarchRegistrationCheck = { ok: true; registration: MarchRegistration } | MarchInvalid;

/** What registering came to, as app/api/march/register answers it. */
export type MarchRegisterResult =
  | { ok: true }
  | MarchInvalid
  /** Not on the guest list: Luma failed, skipped them, or isn't set up. */
  | Refused<"luma-failed">;

const MAX_NAME_LENGTH = 100;
/** The longest address SMTP allows. */
const MAX_EMAIL_LENGTH = 254;
/** Longer than any real city, postcode or utm_source. */
const MAX_OPTIONAL_LENGTH = 100;
/** Loose: one @, something either side, a dot in the domain, no spaces. Luma checks it properly. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const text = (input: unknown) => (typeof input === "string" ? input.trim() : "");

/**
 * An optional field as kept: null when blank, and null too when it's too
 * long or has control characters in it, as such a field is worth less than
 * the sign-up, which mustn't fail on it.
 */
function optional(input: unknown): string | null {
  const value = text(input);
  return value && value.length <= MAX_OPTIONAL_LENGTH && !CONTROL_CHARS.test(value) ? value : null;
}

export function checkMarchRegistration(input: unknown): MarchRegistrationCheck {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = text(raw.name);
  const email = text(raw.email);
  const fields: MarchInvalid["fields"] = {};
  // A number is kept in international format, or the person is asked to fix it: one that can't be texted is no use.
  const typedPhone = text(raw.phone);
  const phone = typedPhone ? phoneNumber(typedPhone) : null;

  if (!name) fields.name = "missing";
  else if (name.length > MAX_NAME_LENGTH || CONTROL_CHARS.test(name)) fields.name = "check";

  if (!email) fields.email = "missing";
  else if (email.length > MAX_EMAIL_LENGTH || CONTROL_CHARS.test(email) || !EMAIL_PATTERN.test(email))
    fields.email = "invalid";

  if (typedPhone && !phone) fields.phone = "invalid";

  if (Object.keys(fields).length > 0) return { ok: false, reason: "invalid", fields };
  return {
    ok: true,
    registration: {
      name,
      email,
      phone,
      city: optional(raw.city),
      postcode: optional(raw.postcode)?.toUpperCase() ?? null,
      consent: raw.consent === true,
      utmSource: optional(raw.utmSource),
    },
  };
}
