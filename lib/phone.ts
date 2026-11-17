// Phone numbers: the one rule for what a typed number is, kept in the
// international form every number is stored in, and how the staff pages
// show one, so every number reads the same. Links, downloads and vCards
// keep the international form, which phones and apps need.

/**
 * The international form: +, the country code, then the number, digits alone,
 * at most fifteen (E.164). The database's `phone` domain is the same rule,
 * which refuses any other number in a column that holds one, as a test checks.
 */
const INTERNATIONAL = /^\+[1-9]\d{6,14}$/;

/**
 * A number in international format. Only phoneNumber() and isInternational()
 * make one, so code that keeps a number, which takes this, can't be handed
 * one as typed.
 */
export type PhoneNumber = string & { readonly brand: unique symbol };

/**
 * Whether a number is in international format, as it's stored, and as
 * WhatsApp and CiviCRM's check take it.
 */
export function isInternational(number: string): number is PhoneNumber {
  return INTERNATIONAL.test(number);
}

/**
 * A number as typed, in international format, or null if it can't be
 * read as one. Spaces, brackets, dots and dashes go; a UK number from 0,
 * 44, or +44 (0) gets +44, and 00 becomes +. A number with no country
 * code that isn't a UK one from 0 can't be read, nor one with anything
 * else in it, such as a ? for a digit a paper form didn't show.
 */
export function phoneNumber(typed: string): PhoneNumber | null {
  const digits = typed.replace(/[\s().-]/g, "");
  const number = /^\+440[1-9]\d{8,9}$/.test(digits)
    ? `+44${digits.slice(4)}`
    : /^00[1-9]\d{6,14}$/.test(digits)
      ? `+${digits.slice(2)}`
      : /^0[1-9]\d{8,9}$/.test(digits)
        ? `+44${digits.slice(1)}`
        : /^44[1-9]\d{9}$/.test(digits)
          ? `+${digits}`
          : digits;
  return isInternational(number) ? number : null;
}

/** Rows whose numbers have been read (withNumbersRead()). */
export type NumbersRead<T extends { phone: string | null }> = Omit<T, "phone"> & { phone: PhoneNumber | null };

/**
 * Rows with each number in international format, as they're kept, and none
 * where it can't be read as one (phoneNumber()); and how many couldn't be,
 * for an import to report, as the number is the source's to fix.
 */
export function withNumbersRead<T extends { phone: string | null }>(
  rows: T[],
): { rows: NumbersRead<T>[]; unread: number } {
  let unread = 0;
  const read = rows.map((row) => {
    const phone = row.phone === null ? null : phoneNumber(row.phone);
    if (row.phone !== null && !phone) unread++;
    return { ...row, phone };
  });
  return { rows: read, unread };
}

/**
 * A number as people in the UK write it: a UK one from 0, in its groups,
 * "07700 900000" or, in London, "020 7946 0000"; any other as it is. Takes
 * a number as stored ("+447700900000") or as typed ("07700 900 000",
 * "+44 (0)7700 900000"), and gives one it can't read as UK as it came.
 */
export function phoneWords(number: string): string {
  const digits = number.replace(/[\s().-]/g, "");
  const uk = /^(?:\+44|0044|44)0?(\d{10})$/.exec(digits)?.[1] ?? /^0(\d{10})$/.exec(digits)?.[1];
  if (!uk) return number;
  return uk.startsWith("2")
    ? `0${uk.slice(0, 2)} ${uk.slice(2, 6)} ${uk.slice(6)}`
    : `0${uk.slice(0, 4)} ${uk.slice(4)}`;
}
