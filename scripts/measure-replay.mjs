// Stands in for every other site a measured page fetches from
// (scripts/measure-page.mjs): Google's Tag Manager and Analytics, the joining
// form embedded from pauseai.info, and whatever they fetch in turn. The
// browser is pointed here for every host but the page's own, so a measurement
// is never counted as a visit, and its figures don't move with those sites.
//
// The first time a file is asked for, it's fetched from the real site and
// kept, in tmp/measure/replay/; from then on the kept copy is served, as
// compressed as the real one was, so it takes the same time on the simulated
// connection. Once `freeze()` is called, before the loads that count, nothing
// more is fetched: a file not kept gets an empty answer.
//
// What's never fetched, kept or passed on (isBeacon): anything that isn't a
// GET, and whatever goes to the hosts that count visits. Those get an empty
// answer, so the scripts that send them carry on.
//
// Delete tmp/measure/replay/ to fetch everything afresh.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";
import { join } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

/** The hosts that count visits and show adverts: Google's, bar the one its scripts come from, and Sentry's. */
const COUNTING_HOSTS =
  /(^|\.)(google-analytics\.com|analytics\.google\.com|doubleclick\.net|googleadservices\.com|googlesyndication\.com|google\.[a-z.]+|sentry\.io)$/;

/** A real site's headers that would be wrong on a kept copy, or that the browser mustn't act on. */
const DROPPED_HEADERS = new Set([
  "alt-svc",
  "age",
  "connection",
  "content-encoding",
  "content-length",
  "date",
  "keep-alive",
  "nel",
  "report-to",
  "set-cookie",
  "strict-transport-security",
  "transfer-encoding",
]);

/** The kinds of file a site compresses on its way to a browser. */
const TEXT = /javascript|json|css|html|svg|xml|text\//;
/**
 * The Brotli quality that gives Google's and pauseai.info's scripts the sizes
 * a browser gets them at, within a tenth: a site compressing as it
 * serves doesn't use the strongest.
 */
const COMPRESSION = 5;

/** Whether a request reports a visit rather than fetches a file: never passed on to the real site. */
export function isBeacon(method, url) {
  const { hostname, pathname } = new URL(url);
  return method !== "GET" || COUNTING_HOSTS.test(hostname) || pathname.includes("/collect");
}

/** The name a kept file goes by: its address, query and all, hashed. */
export function keptName(url) {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

/** A file from the real site, as it's kept: its status, the headers worth keeping, and its body compressed as it came. */
async function fetchReal(url, accept) {
  const response = await fetch(url, {
    headers: { accept: accept ?? "*/*", "user-agent": "Mozilla/5.0 (measure-page)" },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const headers = {};
  for (const [name, value] of response.headers) if (!DROPPED_HEADERS.has(name)) headers[name] = value;
  // fetch hands the body over uncompressed, and a site doesn't always
  // compress for it what it would for a browser. So anything that's text is
  // compressed here, at the strength that comes out the size sites send
  // (COMPRESSION).
  let body = Buffer.from(await response.arrayBuffer());
  if (TEXT.test(response.headers.get("content-type") ?? "")) {
    body = brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: COMPRESSION } });
    headers["content-encoding"] = "br";
  }
  return { status: response.status, headers, body };
}

/**
 * Starts the stand-in on a port of its own. Returns the `port`; `freeze`,
 * which stops it fetching anything more, and `thaw`, which lets it again;
 * `counts` of what it has served (`kept` copies, files `fetched` from the real
 * site, `empty` answers, and those of them that `missed` a file it wasn't
 * allowed to fetch); and `stop`.
 */
export async function startReplay(folder = join("tmp", "measure", "replay")) {
  mkdirSync(folder, { recursive: true });
  const [key, cert] = [join(folder, "key.pem"), join(folder, "cert.pem")];
  if (!existsSync(cert)) {
    // Any certificate does: the browser is told not to check it (measure-page.mjs).
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "3650",
        "-subj",
        "/CN=measure-replay",
        "-keyout",
        key,
        "-out",
        cert,
      ],
      { stdio: "ignore" },
    );
  }
  let frozen = false;
  const counts = { kept: 0, fetched: 0, empty: 0, missed: 0 };
  // Two requests for one file, as a page makes, fetch it once.
  const fetching = new Map();

  async function answer(method, url, accept) {
    if (isBeacon(method, url)) return undefined;
    const base = join(folder, keptName(url));
    if (existsSync(`${base}.json`)) {
      counts.kept++;
      return { ...JSON.parse(readFileSync(`${base}.json`, "utf8")), body: readFileSync(`${base}.body`) };
    }
    if (frozen) {
      counts.missed++;
      return undefined;
    }
    if (!fetching.has(url)) {
      fetching.set(
        url,
        fetchReal(url, accept).then((real) => {
          writeFileSync(`${base}.body`, real.body);
          writeFileSync(`${base}.json`, JSON.stringify({ url, status: real.status, headers: real.headers }, null, 2));
          return real;
        }),
      );
    }
    counts.fetched++;
    return fetching.get(url).catch(() => undefined);
  }

  const server = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (request, response) => {
    const url = `https://${request.headers.host}${request.url}`;
    // The request's own body, a report of a visit if anything, is thrown away.
    request.resume();
    void answer(request.method, url, request.headers.accept).then((found) => {
      if (!found) {
        counts.empty++;
        // Empty, and readable from any page, so the script that asked carries on.
        response.writeHead(204, {
          "access-control-allow-origin": request.headers.origin ?? "*",
          "access-control-allow-credentials": "true",
        });
        response.end();
        return;
      }
      response.writeHead(found.status, { ...found.headers, "content-length": found.body.length });
      response.end(found.body);
    });
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    port: server.address().port,
    counts,
    freeze: () => (frozen = true),
    thaw: () => (frozen = false),
    stop: () =>
      new Promise((done) => {
        server.close(done);
        server.closeAllConnections();
      }),
  };
}
