import { describe, expect, it } from "vitest";
import {
  goingWrong,
  groupFound,
  hoursBefore,
  isHealthGroup,
  lateJob,
  type RunSeen,
  sinceLast,
  textsFound,
  unansweredFound,
} from "./health";

const NOW = new Date("2026-11-26T12:00:00Z");
const run = (at: string, wrong = false): RunSeen => ({ at: new Date(at), wrong });

describe("the health checks' groups", () => {
  it("knows its groups by their address", () => {
    expect(isHealthGroup("product/replies")).toBe(true);
    expect(isHealthGroup("product/nothing")).toBe(false);
  });

  it("is good when every check is, each under its name", () => {
    expect(groupFound("technical/sending", [{ status: "ok", failedInARow: 0 }, { status: "ok" }])).toEqual({
      group: "technical/sending",
      status: "ok",
      checks: { "email-sending": { status: "ok", failedInARow: 0 }, "whatsapp-sending": { status: "ok" } },
    });
  });

  it("is bad when any check is", () => {
    expect(groupFound("technical/sending", [{ status: "ok" }, { status: "bad" }]).status).toBe("bad");
  });
});

describe("a late job", () => {
  it("isn't one that has never run", () => {
    expect(lateJob("read-gmail", undefined, NOW)).toBeUndefined();
  });

  it("isn't one whose next run is within its grace", () => {
    // Every five minutes: due at 11:45, and a quarter of an hour's grace.
    expect(lateJob("read-gmail", run("2026-11-26T11:40:13Z"), NOW)).toBeUndefined();
  });

  it("is one whose next run was due longer ago than its grace, with when", () => {
    expect(lateJob("read-gmail", run("2026-11-26T11:15:13Z"), NOW)).toEqual({
      job: "read-gmail",
      lastRan: "2026-11-26T11:15:13.000Z",
      nextRunWasDue: "2026-11-26T11:20:00.000Z",
      minutesOverdue: 40,
    });
  });

  it("gives a nightly job three hours", () => {
    // Due at 06:21 each day.
    const lastNight = run("2026-11-25T06:21:30Z");
    expect(lateJob("import-parliament", lastNight, new Date("2026-11-26T09:21:00Z"))).toBeUndefined();
    expect(lateJob("import-parliament", lastNight, new Date("2026-11-26T09:22:00Z"))?.minutesOverdue).toBe(181);
  });
});

describe("a job going wrong", () => {
  it("is one whose last three times all went wrong", () => {
    expect(
      goingWrong([run("2026-11-26T11:49Z", true), run("2026-11-26T10:49Z", true), run("2026-11-26T09:49Z", true)]),
    ).toBe(true);
  });

  it("isn't one that went right at any of them", () => {
    expect(goingWrong([run("2026-11-26T11:49Z", true), run("2026-11-26T10:49Z"), run("2026-11-26T09:49Z", true)])).toBe(
      false,
    );
  });

  it("isn't one that has run only twice", () => {
    expect(goingWrong([run("2026-11-26T11:49Z", true), run("2026-11-26T10:49Z", true)])).toBe(false);
  });

  it("counts a run tried again within seconds once, as its newest try went", () => {
    const retried = [
      run("2026-11-26T11:49:10Z", true),
      run("2026-11-26T11:49:08Z", true),
      run("2026-11-26T11:49:07Z", true),
    ];
    expect(goingWrong(retried)).toBe(false);
    expect(goingWrong([...retried, run("2026-11-26T10:49Z", true), run("2026-11-26T09:49Z", true)])).toBe(true);
    // The second time's last try went right, though its first didn't.
    expect(
      goingWrong([
        run("2026-11-26T11:49Z", true),
        run("2026-11-26T10:49:05Z"),
        run("2026-11-26T10:49:00Z", true),
        run("2026-11-26T09:49Z", true),
      ]),
    ).toBe(false);
  });
});

describe("how long since something last happened", () => {
  it("is bad when it never has", () => {
    expect(sinceLast(null, 24, NOW)).toEqual({ status: "bad", hoursSinceLast: null, limitHours: 24 });
  });

  it("is good within the limit, and bad at it", () => {
    expect(sinceLast(new Date("2026-11-25T12:00:01Z"), 24, NOW)).toEqual({
      status: "ok",
      hoursSinceLast: 23,
      limitHours: 24,
    });
    expect(sinceLast(new Date("2026-11-25T12:00:00Z"), 24, NOW).status).toBe("bad");
  });
});

describe("the texts delivered", () => {
  it("says nothing of too few", () => {
    expect(textsFound(49, 0)).toEqual({ status: "ok", handed: 49, delivered: 0 });
  });

  it("is bad when fewer than half of enough arrived", () => {
    expect(textsFound(50, 24).status).toBe("bad");
    expect(textsFound(50, 25).status).toBe("ok");
  });
});

describe("what got nothing back", () => {
  it("is good when nothing did", () => {
    expect(unansweredFound([])).toEqual({ status: "ok", unanswered: [] });
  });

  it("is bad when something did, with which and when it went", () => {
    expect(unansweredFound([{ id: 7, sent: new Date("2026-11-22T09:00:00Z") }])).toEqual({
      status: "bad",
      unanswered: [{ id: 7, sent: "2026-11-22T09:00:00.000Z" }],
    });
  });
});

it("counts hours back", () => {
  expect(hoursBefore(NOW, 36)).toEqual(new Date("2026-11-25T00:00:00Z"));
});
