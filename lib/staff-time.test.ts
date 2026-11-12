import { describe, expect, it, vi } from "vitest";
import {
  datesHeldTogether,
  earliestHour,
  fromLondon,
  hourNotTooSoon,
  londonDayHour,
  londonClock,
  londonDate,
  londonStart,
  londonWhen,
  londonWhenShort,
  sendsAt,
  staffClock,
  staffDate,
  staffDay,
  staffTime,
} from "./staff-time";

it("names the day, in UTC", () => {
  expect(staffDate(new Date("2026-11-03T10:34:56Z"))).toBe("3 Nov 2026");
  expect(staffDate(new Date("2026-10-16T23:30:00-05:00"))).toBe("17 Oct 2026");
});

it("is the day and the time to the minute, in UTC", () => {
  expect(staffTime(new Date("2026-10-16T10:34:56.789Z"))).toBe("16 Oct 2026, 10:34");
  expect(staffTime(new Date("2026-10-16T23:30:00+01:00"))).toBe("16 Oct 2026, 22:30");
});

it("holds each date in some words together with no-break spaces, the time with it, and leaves the rest", () => {
  expect(datesHeldTogether("Unsubscribed on 20 Sept 2026, from Luma")).toBe("Unsubscribed on 20 Sept 2026, from Luma");
  expect(datesHeldTogether("3 Nov 2026, 10:34 then 16 Oct 2026")).toBe("3 Nov 2026, 10:34 then 16 Oct 2026");
  expect(datesHeldTogether("No date here, 2026")).toBe("No date here, 2026");
});

it("names the weekday, day and month, in UTC", () => {
  expect(staffDay(new Date("2026-10-16T12:00:00Z"))).toBe("Friday 16 October");
  expect(staffDay(new Date("2026-10-16T23:30:00-05:00"))).toBe("Saturday 17 October");
});

it("is the time of day to the minute, in UTC", () => {
  expect(staffClock(new Date("2026-10-16T09:04:56.789Z"))).toBe("09:04");
  expect(staffClock(new Date("2026-10-16T23:30:00+01:00"))).toBe("22:30");
});

describe("London's time, for when a mailing goes", () => {
  it("reads a moment as London's day and hour, in winter and in summer time", () => {
    expect(londonDayHour(new Date("2026-11-30T09:00:00Z"))).toEqual({ day: "2026-11-30", hour: 9 });
    expect(londonDayHour(new Date("2026-07-01T23:30:00Z"))).toEqual({ day: "2026-07-02", hour: 0 });
  });

  it("makes a moment from London's day and hour", () => {
    expect(fromLondon("2026-11-30", 9)).toEqual(new Date("2026-11-30T09:00:00.000Z"));
    expect(fromLondon("2026-07-02", 0)).toEqual(new Date("2026-07-01T23:00:00.000Z"));
  });

  it("says when, in London", () => {
    expect(londonWhen(new Date("2026-10-30T09:00:00Z"))).toBe("Friday 30 October at 09:18");
    expect(londonWhen(new Date("2026-07-02T08:00:00Z"))).toBe("Thursday 2 July at 09:18");
    expect(londonWhenShort(new Date("2026-10-30T09:00:00Z"))).toBe("Fri 30 Oct, 09:18");
    expect(londonWhen(new Date("2026-10-30T09:00:00Z"), "short")).toBe("Fri 30 Oct at 09:18");
    // Overnight, when the sending doesn't run, at its first run of the morning.
    expect(londonWhen(new Date("2026-10-30T03:00:00Z"))).toBe("Friday 30 October at 06:18");
    expect(londonWhen(new Date("2026-07-02T02:00:00Z"))).toBe("Thursday 2 July at 07:18");
  });
});

it("sends a mailing at its hour's run of the sending, or overnight at the morning's first", () => {
  expect(sendsAt(new Date("2026-10-30T09:00:00.000Z"))).toEqual(new Date("2026-10-30T09:18:00.000Z"));
  expect(sendsAt(new Date("2026-10-30T23:00:00.000Z"))).toEqual(new Date("2026-10-30T23:18:00.000Z"));
  expect(sendsAt(new Date("2026-10-30T00:00:00.000Z"))).toEqual(new Date("2026-10-30T06:18:00.000Z"));
  expect(londonClock(new Date("2026-07-02T23:18:00Z"))).toBe("00:18");
});

describe("the first hour a mailing can go", () => {
  it("is the first whole hour whose run of the sending is at least five minutes away", () => {
    vi.useFakeTimers({ now: new Date("2026-07-01T10:30:00Z"), toFake: ["Date"] });
    try {
      expect(earliestHour()).toEqual(new Date("2026-07-01T11:00:00.000Z"));
      vi.setSystemTime(new Date("2026-07-01T11:05:00Z"));
      expect(earliestHour()).toEqual(new Date("2026-07-01T11:00:00.000Z"));
      vi.setSystemTime(new Date("2026-07-01T11:13:00Z"));
      expect(earliestHour()).toEqual(new Date("2026-07-01T11:00:00.000Z"));
      vi.setSystemTime(new Date("2026-07-01T11:14:00Z"));
      expect(earliestHour()).toEqual(new Date("2026-07-01T12:00:00.000Z"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("moves an hour too soon on that day to it, and keeps any other", () => {
    const earliest = { day: "2026-07-01", hour: 12 };
    expect(hourNotTooSoon("2026-07-01", 9, earliest)).toBe(12);
    expect(hourNotTooSoon("2026-07-01", 14, earliest)).toBe(14);
    expect(hourNotTooSoon("2026-07-02", 9, earliest)).toBe(9);
  });
});

it("says the day something happens, in London, with its year", () => {
  expect(londonDate(new Date("2026-10-27T12:00:00Z"))).toBe("27 Oct 2026");
  // Past midnight in London, still the day before in UTC.
  expect(londonDate(new Date("2026-07-02T23:30:00Z"))).toBe("3 Jul 2026");
});

it("says when something starts, in London, with its year", () => {
  expect(londonStart(new Date("2026-11-10T18:00:00Z"))).toBe("Tue 10 Nov 2026, 18:00");
  expect(londonStart(new Date("2026-07-02T18:00:00Z"))).toBe("Thu 2 Jul 2026, 19:00");
});
