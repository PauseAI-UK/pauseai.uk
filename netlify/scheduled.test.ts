import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { IMPORT_JOBS, type JobSchedule, isImportJob, jobSchedule } from "@/lib/import-runs";
import { callSite, fromSchedule, runsJob, startBackground } from "./scheduled";

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

  it("are one for each job, named after it, running as often as the job says", () => {
    const scheduled = Object.entries(functions).filter(([, module]) => module.config?.schedule);
    expect(scheduled.map(([folder]) => folder).sort()).toEqual([...IMPORT_JOBS].sort());
    for (const [folder, module] of scheduled) {
      expect(isImportJob(folder) && cronSchedule(module.config!.schedule), folder).toBe(
        isImportJob(folder) && jobSchedule(folder),
      );
    }
  });

  it("each ask the site to run their own job, but those that start a background function", async () => {
    const asked: string[] = [];
    server.use(
      http.post("https://pauseai.uk/api/cron/:job", ({ params }) => {
        asked.push(String(params.job));
        return HttpResponse.json({ sent: 0, skipped: 0, failed: 0, left: 0 });
      }),
      http.post("https://pauseai.uk/.netlify/functions/:name", () => new HttpResponse(null, { status: 202 })),
    );
    for (const job of IMPORT_JOBS) {
      asked.length = 0;
      await functions[job].default(new Request("https://pauseai.uk/"));
      expect(asked, job).toEqual(job === "import-luma" ? [] : [job]);
    }
  });
});

describe("callSite", () => {
  it("asks the site to run a job with the secret, and gives its answer", async () => {
    let auth: string | null = null;
    server.use(
      http.post("https://pauseai.uk/api/cron/check-mps", ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({ problems: 0 });
      }),
    );
    expect(JSON.parse(await callSite("check-mps"))).toEqual({ problems: 0 });
    expect(auth).toBe("Bearer s3cret");
    expect(await (await runsJob("check-mps")()).json()).toEqual({ problems: 0 });
  });

  it("fails loudly if the site does", async () => {
    server.use(http.post("https://pauseai.uk/api/cron/check-mps", () => new HttpResponse("nope", { status: 401 })));
    await expect(callSite("check-mps")).rejects.toThrow("/api/cron/check-mps returned 401: nope");
  });
});

describe("startBackground", () => {
  it("starts a background function with the secret", async () => {
    let auth: string | null = null;
    server.use(
      http.post("https://pauseai.uk/.netlify/functions/import-luma-background", ({ request }) => {
        auth = request.headers.get("authorization");
        return new HttpResponse(null, { status: 202 });
      }),
    );
    await startBackground("import-luma-background");
    expect(auth).toBe("Bearer s3cret");
  });

  it("fails loudly if it doesn't start", async () => {
    server.use(
      http.post(
        "https://pauseai.uk/.netlify/functions/import-luma-background",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    await expect(startBackground("import-luma-background")).rejects.toThrow("import-luma-background returned 404");
  });
});

describe("fromSchedule", () => {
  const call = (authorization?: string) =>
    new Request("https://pauseai.uk/.netlify/functions/x", { headers: authorization ? { authorization } : {} });

  it("is a call with the secret, never one when none is set", () => {
    expect(fromSchedule(call("Bearer s3cret"))).toBe(true);
    expect(fromSchedule(call("Bearer guess"))).toBe(false);
    expect(fromSchedule(call())).toBe(false);
    vi.stubEnv("CRON_SECRET", "");
    expect(fromSchedule(call("Bearer "))).toBe(false);
  });
});
