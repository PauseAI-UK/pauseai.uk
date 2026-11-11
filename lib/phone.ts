// How the staff pages show a phone number: one place, so every number reads
// the same. Links, downloads and vCards keep the international form a
// number is stored in, which phones and apps need.

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
