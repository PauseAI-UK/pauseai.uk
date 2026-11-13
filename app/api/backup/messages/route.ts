import { NextResponse, type NextRequest } from "next/server";
import { isBackupRequest } from "@/lib/server/cron";
import { keptMessage, keptMessageKeys } from "@/lib/server/kept-messages";

/**
 * For the backup's container (backup/container/messages.ts): every kept
 * message's key, or with `?key=`, that message, gzipped as it's stored.
 * Read-only.
 */
export async function GET(request: NextRequest) {
  if (!isBackupRequest(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const key = request.nextUrl.searchParams.get("key");
  if (key === null) return NextResponse.json({ keys: await keptMessageKeys() });
  const file = await keptMessage(key);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(file), { headers: { "Content-Type": "application/gzip" } });
}
