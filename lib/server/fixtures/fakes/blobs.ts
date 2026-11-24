import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { Fake } from "../fake";

// Netlify Blobs, kept for the life of the process, shared by every bundle
// of the server. A key under fixture/ that wasn't stored is read from
// lib/server/fixtures/letter-replies/, gzipped, so a fixture database can name
// replies that are there from the start.
const BLOBS = ((globalThis as { fixtureBlobs?: Map<string, Uint8Array> }).fixtureBlobs ??= new Map());

function blobResponse(pathname: string, init?: RequestInit): Response {
  const key = decodeURIComponent(pathname.split("/").slice(3).join("/"));
  if (init?.method?.toUpperCase() === "PUT") {
    BLOBS.set(key, new Uint8Array(init.body as ArrayBuffer));
    return new Response(null, { status: 200 });
  }
  if (init?.method?.toUpperCase() === "DELETE") {
    BLOBS.delete(key);
    return new Response(null, { status: 204 });
  }
  const stored = BLOBS.get(key) ?? fixtureReply(key);
  return stored ? new Response(stored as BodyInit) : new Response(null, { status: 404 });
}

function fixtureReply(key: string): Uint8Array | undefined {
  const name = /^fixture\/([\w-]+\.eml)\.gz$/.exec(key)?.[1];
  // From the checkout's root, where the tests and fixture builds run: a build's own files are elsewhere. The
  // turbopackIgnores keep Turbopack from tracing the whole project into every build's server code for this path.
  const file = name && join(process.cwd(), "lib/server/fixtures/letter-replies", name);
  return file && existsSync(/*turbopackIgnore: true*/ file)
    ? gzipSync(readFileSync(/*turbopackIgnore: true*/ file))
    : undefined;
}

export const blobsFake: Fake = ({ hostname, pathname }, init) =>
  hostname === "blobs.fixture.invalid" ? blobResponse(pathname, init) : undefined;
