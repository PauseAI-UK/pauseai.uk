import { NextResponse } from "next/server";
import { now } from "@/lib/now";
import { HEALTH_HTTP_STATUS, isHealthGroup } from "@/lib/oversight/health";
import { checkHealth } from "@/lib/oversight/health.server";

/**
 * One group of health checks, such as /api/health/product/replies, for an
 * outside monitor: 200 when every check in it is good, 503 when any is bad,
 * with what each found (lib/oversight/health.ts). Anyone can ask.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; group: string }> }) {
  const { kind, group } = await params;
  const name = `${kind}/${group}`;
  if (!isHealthGroup(name)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const at = now();
  const found = await checkHealth(name, at);
  return NextResponse.json(
    { ...found, checkedAt: at.toISOString() },
    { status: HEALTH_HTTP_STATUS[found.status], headers: { "Cache-Control": "no-store" } },
  );
}

export { GET as HEAD };
