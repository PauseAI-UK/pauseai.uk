import "server-only";
import { Agent } from "undici";

/**
 * The connection pool outsideFetch gives fetch for a request with
 * `largeHeaders`, with room for 128 KB of an answer's headers, as fetch's own
 * limit is 16 KB. It's undici's, the library Node's fetch is built on, of
 * the version Node 24 has (package.json), as fetch takes a pool only from
 * that version.
 */
export const largeHeaderPool = new Agent({ maxHeaderSize: 128 * 1024 });
