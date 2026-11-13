import { describe, expect, it, vi } from "vitest";
import type { DumpReport } from "../container/backup.ts";
import type { MessagesReport } from "../container/messages.ts";
import type { Manifest } from "./checks.ts";
import { LATEST, takeBackup, type BackupDeps } from "./run.ts";

const NOW = new Date("2026-10-19T03:00:00.123Z");
const REPORT: DumpReport = { bytes: 3, sha256: "abc", tables: { letters: { rows: 2, newest: null } } };
const MESSAGES: MessagesReport = { bytes: 4, sha256: "def", messages: 2, fetched: 2, missing: [], failed: [] };

/** The container: a dump's report and dump, and a messages' archive's report and the archive. */
async function containerServer(path: string, init?: RequestInit): Promise<Response> {
  if (path === "/backup") return Response.json(REPORT);
  if (path.startsWith("/messages")) return init?.method === "POST" ? Response.json(MESSAGES) : new Response("TARS");
  return new Response("DUMP");
}

function fakeBucket(objects: Record<string, string> = {}) {
  return {
    objects,
    get: vi.fn(async (key: string) =>
      key in objects ? { text: async () => objects[key], body: new Response(objects[key]).body! } : null,
    ),
    put: vi.fn(async (key: string, value: string) => {
      objects[key] = value;
    }),
  };
}

type Upload = [string, string, Pick<DumpReport, "bytes" | "sha256">];

function deps(overrides: Partial<BackupDeps> = {}): BackupDeps & { uploads: Upload[] } {
  const uploads: Upload[] = [];
  return {
    bucket: fakeBucket(),
    container: containerServer,
    upload: async (key, body, report) => {
      uploads.push([key, await new Response(body).text(), report]);
    },
    rules: { letters: { neverShrinks: true } },
    now: NOW,
    uploads,
    ...overrides,
  };
}

describe("takeBackup", () => {
  it("stores the dump and its manifest, and finds no problems in a good backup", async () => {
    const bucket = fakeBucket();
    const container = vi.fn(containerServer);
    const d = deps({ bucket, container, rules: { letters: { timestamp: "created_at" } } });
    const outcome = await takeBackup(d);

    expect(container).toHaveBeenCalledWith("/backup", {
      method: "POST",
      body: JSON.stringify({ timestamps: { letters: "created_at" } }),
    });
    // No archive before, so none to copy from.
    expect(container).toHaveBeenCalledWith("/messages?at=2026-10-19T03%3A00%3A00.123Z", { method: "POST" });
    expect(d.uploads).toEqual([
      ["dumps/2026-10-19T03-00-00Z.dump", "DUMP", REPORT],
      ["messages/2026-10-19T03-00-00Z.tar", "TARS", MESSAGES],
    ]);
    const manifest = {
      at: "2026-10-19T03:00:00.123Z",
      key: "dumps/2026-10-19T03-00-00Z.dump",
      ...REPORT,
      messages: { key: "messages/2026-10-19T03-00-00Z.tar", ...MESSAGES },
    };
    expect(outcome).toEqual({ manifest, problems: [] });
    expect(JSON.parse(bucket.objects["manifests/2026-10-19T03-00-00Z.json"])).toEqual(manifest);
    expect(JSON.parse(bucket.objects[LATEST])).toEqual(manifest);
  });

  it("compares with the last backup", async () => {
    const previous: Manifest = {
      ...REPORT,
      at: "2026-10-18T03:00:00.000Z",
      key: "k",
      tables: { letters: { rows: 5 } },
    };
    const outcome = await takeBackup(deps({ bucket: fakeBucket({ [LATEST]: JSON.stringify(previous) }) }));
    expect(outcome.problems).toEqual(["letters: 2 rows, down from 5 in the backup of 2026-10-18T03:00:00.000Z."]);
  });

  it("reports a backup the container couldn't take", async () => {
    const bucket = fakeBucket();
    const outcome = await takeBackup(
      deps({ bucket, container: async () => new Response("pg_dump exited with 1: no", { status: 500 }) }),
    );
    expect(outcome).toEqual({
      problems: ["The container couldn't back up the database: 500, pg_dump exited with 1: no"],
    });
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("reports a dump the container couldn't send", async () => {
    for (const dump of [new Response("gone", { status: 500 }), new Response(null)]) {
      const outcome = await takeBackup(
        deps({ container: async (path, init) => (path === "/dump" ? dump : containerServer(path, init)) }),
      );
      expect(outcome.problems).toEqual([`The container couldn't send the dump: ${dump.status}.`]);
    }
  });

  it("reports a dump that couldn't be stored", async () => {
    const bucket = fakeBucket();
    const outcome = await takeBackup(
      deps({
        bucket,
        upload: async () => {
          throw new Error("R2 said no");
        },
      }),
    );
    expect(outcome).toEqual({ problems: ["R2 said no"] });
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("keeps the dump, saying why, where the messages couldn't be archived, sent or stored", async () => {
    const failing = (path: string, init: RequestInit | undefined, answer: Response) =>
      path.startsWith("/messages") && (init?.method === "POST") === (answer.status === 500)
        ? answer
        : containerServer(path, init);
    const cases: [Partial<BackupDeps>, string][] = [
      [
        { container: async (path, init) => failing(path, init, new Response("no site", { status: 500 })) },
        "The container couldn't archive the messages: 500, no site",
      ],
      [
        { container: async (path, init) => failing(path, init, new Response(null, { status: 404 })) },
        "The container couldn't send the messages: 404.",
      ],
      [
        // An old container answering an address it doesn't know: its status alone, as it says nothing.
        {
          container: async (path, init) =>
            path.startsWith("/messages") && init?.method === "POST"
              ? new Response(null, { status: 404 })
              : containerServer(path, init),
        },
        "The container couldn't archive the messages: 404",
      ],
      [
        { container: async (path, init) => failing(path, init, new Response(null)) },
        "The container couldn't send the messages: 200.",
      ],
      [
        {
          upload: async (key) => {
            if (key.startsWith("messages/")) throw new Error("R2 said no");
          },
        },
        "R2 said no",
      ],
    ];
    for (const [overrides, problem] of cases) {
      const bucket = fakeBucket();
      const outcome = await takeBackup(deps({ bucket, ...overrides }));
      expect(outcome.problems).toEqual([problem]);
      expect(outcome.manifest).not.toHaveProperty("messages");
      expect(JSON.parse(bucket.objects[LATEST]).key).toBe("dumps/2026-10-19T03-00-00Z.dump");
    }
  });

  it("sends the container last night's archive to copy from, every night it's there", async () => {
    const lastNight: Manifest = {
      ...REPORT,
      at: "2026-10-18T03:00:00.000Z",
      key: "k",
      messages: { key: "messages/last.tar", ...MESSAGES },
    };
    const sent: (string | null)[] = [];
    const container = async (path: string, init?: RequestInit) => {
      if (path.startsWith("/messages") && init?.method === "POST") {
        sent.push(init.body ? await new Response(init.body).text() : null);
      }
      return containerServer(path, init);
    };
    const bucket = () => fakeBucket({ [LATEST]: JSON.stringify(lastNight), "messages/last.tar": "LAST" });
    await takeBackup(deps({ bucket: bucket(), container }));
    // Gone from the bucket, as it expired: none.
    await takeBackup(deps({ bucket: fakeBucket({ [LATEST]: JSON.stringify(lastNight) }), container }));
    expect(sent).toEqual(["LAST", null]);
  });
});
