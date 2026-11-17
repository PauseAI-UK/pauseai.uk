// Numbers as people type them, each with the international form it is, or
// null where it can't be read as one: what phoneNumber() in lib/phone.ts and
// phone_number() in the database must agree on.
export const PHONE_NUMBERS: [typed: string, number: string | null][] = [
  ["+447700900123", "+447700900123"],
  ["+44 7700 900123", "+447700900123"],
  ["+44 (0)7700 900123", "+447700900123"],
  ["+4407700900123", "+447700900123"],
  ["07700 900123", "+447700900123"],
  ["07700-900-123", "+447700900123"],
  ["(07700) 900.123", "+447700900123"],
  ["020 7946 0000", "+442079460000"],
  ["0044 7700 900123", "+447700900123"],
  ["447700900123", "+447700900123"],
  ["+1 555 555 0100", "+15555550100"],
  ["+3531234567", "+3531234567"],
  ["  07700 900123  ", "+447700900123"],
  // A UK mobile with its 0 dropped, as a spreadsheet does: no country code, and not from 0.
  ["7700900123", null],
  // Another country's, without its +.
  ["15555550100", null],
  ["55 27 98871-5031", null],
  // A digit a paper form didn't show.
  ["0770?900123", null],
  ["07700 9001", null],
  ["+", null],
  ["", null],
  ["  ", null],
  ["+0447700900123", null],
  ["+4477009001231234", null],
  ["call me", null],
];
