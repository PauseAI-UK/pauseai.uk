import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { backUp, type TimestampColumns } from "./backup.ts";
import { archiveMessages, why, type Site } from "./messages.ts";

// The container's HTTP interface, which only the Worker can reach:
//
//   POST /backup    {"timestamps": {"letters": "created_at"}}
//                   dumps the database and replies with the DumpReport, or a
//                   500 with why it failed
//   GET  /dump      the dump the last POST /backup made
//   POST /messages?at=2026-11-13T03:00:00.000Z
//                   archives the site's kept messages, dated `at`, copying
//                   those it can from last night's archive, the body if the
//                   Worker sends one, and replies with the MessagesReport, or
//                   a 500 with why it couldn't
//   GET  /messages  the archive the last POST /messages made

/** Where the dump, the messages' archive and last night's go, and how to ask the site, if the container was told. */
export interface Paths {
  dump: string;
  messages: string;
  previous: string;
  site?: Site;
}

export function backupServer(databaseUrl: string, paths: Paths): Server {
  return createServer(async (request, response) => {
    // A server request always has its URL.
    const url = new URL(request.url!, "http://container");
    try {
      if (request.method === "POST" && request.url === "/backup") {
        const { timestamps } = JSON.parse(await readBody(request)) as { timestamps: TimestampColumns };
        const report = await backUp(databaseUrl, paths.dump, timestamps);
        response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(report));
      } else if (request.method === "GET" && request.url === "/dump") {
        await sendFile(paths.dump, response);
      } else if (request.method === "POST" && url.pathname === "/messages") {
        if (!paths.site) throw new Error("SITE_URL or SITE_BACKUP_SECRET isn't set, so the messages weren't archived.");
        const at = new Date(url.searchParams.get("at") ?? "");
        if (isNaN(at.getTime())) throw new Error("No time to date the messages by.");
        // Last night's archive, if sent, saved to copy from; none, an empty file, which it doesn't use.
        await pipeline(request, createWriteStream(paths.previous));
        const report = await archiveMessages(paths.site, paths.messages, at, paths.previous);
        response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(report));
      } else if (request.method === "GET" && request.url === "/messages") {
        await sendFile(paths.messages, response);
      } else {
        response.writeHead(404).end();
      }
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain" }).end(why(error));
    }
  });
}

/** Sends a file the container made, with its length. */
async function sendFile(path: string, response: ServerResponse): Promise<void> {
  const { size } = await stat(path);
  response.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": size });
  createReadStream(path).pipe(response);
}

async function readBody(request: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body;
}
