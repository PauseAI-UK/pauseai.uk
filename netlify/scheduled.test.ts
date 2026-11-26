import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { IMPORT_JOBS, JOBS, type JobSchedule, isImportJob, jobSchedule, NIGHTLY } from "@/lib/import-runs";
import { SENDING } from "@/lib/staff-time";
import { callSite, hasSecret, startsJob } from "./scheduled";

beforeEach(() => {
  vi.stubEnv("URL", "https://pauseai.uk");
  vi.stubEnv("CRON_SECRET", "s3cret");
});
afterEach(() => vi.unstubAllEnvs());

/** Each function in netlify/functions/, by its folder's name. */
const functions = Object.fromEntries(
  Object.entries(
    import.meta.glob<{ default: (request: Request) => Promise<Response | void>; config?: { schedule: string } }>(
      "./functions/*/*.ts",
      { eager: true },
    ),
  )
    .map(([path, module]) => [path.split("/"), module] as const)
    .filter(([[, , folder, file]]) => file === `${folder}.ts`)
    .map(([[, , folder], module]) => [folder, module]),
);

/** How often a cron runs, in the words of lib/import-runs.ts. */
function cronSchedule(cron: string): JobSchedule | undefined {
  const [minute, hour, ...rest] = cron.split(" ");
  if (rest.join(" ") !== "* * *") return undefined;
  if (/^(\*|\d+-\d+)\/5$/.test(minute) && hour === "*") return "frequent";
  // Four minutes, 15 apart.
  const quarters = minute.split(",").map(Number);
  if (quarters.length === 4 && quarters.every((m, i) => m === quarters[0] + 15 * i) && hour === "*") {
    return "quarter-hour";
  }
  if (!/^\d+$/.test(minute)) return undefined;
  if (hour === "*") return "hourly";
  return /^\d+$/.test(hour) ? "nightly" : undefined;
}

describe("the scheduled functions", () => {
  it("tells a cron's schedule apart", () => {
    expect(cronSchedule("*/5 * * * *")).toBe("frequent");
    expect(cronSchedule("2-59/5 * * * *")).toBe("frequent");
    expect(cronSchedule("3,18,33,48 * * * *")).toBe("quarter-hour");
    expect(cronSchedule("3,18,33,49 * * * *")).toBeUndefined();
    expect(cronSchedule("3,18,33,48 6 * * *")).toBeUndefined();
    expect(cronSchedule("18 * * * *")).toBe("hourly");
    expect(cronSchedule("23 6 * * *")).toBe("nightly");
    expect(cronSchedule("23 */2 * * *")).toBeUndefined();
    expect(cronSchedule("*/10 * * * *")).toBeUndefined();
    expect(cronSchedule("0 6 * * 1")).toBeUndefined();
  });

  it("are one for each job, named after it, running when the job says, as often as it says", () => {
    const scheduled = Object.entries(functions).filter(([, module]) => module.config?.schedule);
    expect(scheduled.map(([folder]) => folder).sort()).toEqual([...IMPORT_JOBS].sort());
    for (const [folder, module] of scheduled) {
      expect(isImportJob(folder) && module.config!.schedule, folder).toBe(isImportJob(folder) && JOBS[folder].cron);
      expect(isImportJob(folder) && cronSchedule(module.config!.schedule), folder).toBe(
        isImportJob(folder) && jobSchedule(folder),
      );
    }
  });

  it("each start the background function, to run their own job on the schedule's behalf, with the secret", async () => {
    const started: unknown[] = [];
    server.use(
      http.post("https://pauseai.uk/.netlify/functions/run-job-background", async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer s3cret");
        started.push(await request.json());
        return new HttpResponse(null, { status: 202 });
      }),
    );
    for (const job of IMPORT_JOBS) {
      started.length = 0;
      expect(await (await functions[job].default(new Request("https://pauseai.uk/")))!.text(), job).toBe("Started");
      expect(started, job).toEqual([{ job, startedBy: NIGHTLY }]);
    }
  });

  it("send at the times the staff pages offer a mailing", () => {
    expect(functions["send-mailings"].config!.schedule).toBe(`${SENDING.minutes.join(",")} * * * *`);
  });

  it("fail loudly if the background function won't start", async () => {
    server.use(
      http.post(
        "https://pauseai.uk/.netlify/functions/run-job-background",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    await expect(startsJob("import-luma")()).rejects.toThrow("run-job-background returned 404");
  });
});

describe("callSite", () => {
  it("asks the site to run a job with the secret, as whoever started it, and gives its answer", async () => {
    const asked: unknown[] = [];
    server.use(
      http.post("https://pauseai.uk/api/cron/tidy-logs", async ({ request }) => {
        expect(request.headers.get("authorization")).toBe("Bearer s3cret");
        asked.push(await request.json());
        return HttpResponse.json({ importRuns: 0 });
      }),
    );
    expect(JSON.parse(await callSite("https://pauseai.uk", { job: "tidy-logs", startedBy: NIGHTLY }))).toEqual({
      importRuns: 0,
    });
    await callSite("https://pauseai.uk", { job: "tidy-logs", startedBy: "jo@pauseai.uk", marked: true });
    expect(asked).toEqual([
      { startedBy: NIGHTLY, marked: false },
      { startedBy: "jo@pauseai.uk", marked: true },
    ]);
  });

  it("fails loudly if the site does", async () => {
    server.use(http.post("https://pauseai.uk/api/cron/tidy-logs", () => new HttpResponse("nope", { status: 401 })));
    await expect(callSite("https://pauseai.uk", { job: "tidy-logs", startedBy: NIGHTLY })).rejects.toThrow(
      "/api/cron/tidy-logs returned 401: nope",
    );
  });
});

describe("hasSecret", () => {
  const call = (authorization?: string) =>
    new Request("https://pauseai.uk/.netlify/functions/x", { headers: authorization ? { authorization } : {} });

  it("is a call with the secret, never one when none is set", () => {
    expect(hasSecret(call("Bearer s3cret"))).toBe(true);
    expect(hasSecret(call("Bearer guess"))).toBe(false);
    expect(hasSecret(call())).toBe(false);
    vi.stubEnv("CRON_SECRET", "");
    expect(hasSecret(call("Bearer "))).toBe(false);
  });
});
