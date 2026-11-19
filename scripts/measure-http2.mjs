// Puts HTTP/2 in front of a build served on this machine, for
// scripts/measure-page.mjs's `--http2`. `next start` speaks HTTP/1.1, over
// which a browser fetches six things at a time from a site and queues the
// rest itself. Netlify's CDN speaks HTTP/2, over which the browser asks for
// everything at once and leaves the order to the server. So what a change to
// the order of a page's requests does can differ between the two.
//
// This passes each request on to the build as it is and the answer back,
// over one HTTP/2 connection, sending first what the browser marked as most
// urgent, as Node's HTTP/2 does.
import { request } from "node:http";
import { createSecureServer } from "node:http2";

/** The headers that are about one connection, which HTTP/2 doesn't carry, and the host, which is the build's. */
const DROPPED = new Set(["connection", "host", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade"]);

const kept = (headers) =>
  Object.fromEntries(Object.entries(headers).filter(([name]) => !name.startsWith(":") && !DROPPED.has(name)));

/**
 * Starts the front for the build at `target`, with the `certificate` (`key`
 * and `cert`) to serve under. Returns its `url` and `stop`.
 */
export async function startHttp2(target, certificate) {
  const to = new URL(target);
  const server = createSecureServer(certificate);
  server.on("stream", (stream, headers) => {
    const upstream = request(
      {
        hostname: to.hostname,
        port: to.port,
        path: headers[":path"],
        method: headers[":method"],
        headers: { ...kept(headers), host: to.host },
      },
      (response) => {
        if (stream.destroyed) return response.destroy();
        stream.respond({ ":status": response.statusCode, ...kept(response.headers) });
        response.pipe(stream);
      },
    );
    upstream.on("error", () => stream.close());
    stream.on("error", () => upstream.destroy());
    stream.pipe(upstream);
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    url: `https://localhost:${server.address().port}`,
    stop: () => new Promise((done) => server.close(done)),
  };
}
