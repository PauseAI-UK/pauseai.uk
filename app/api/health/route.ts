import { NextResponse } from "next/server";
import { now } from "@/lib/now";
import { HEALTH_HTTP_STATUS } from "@/lib/oversight/health";
import { checkAllHealth } from "@/lib/oversight/health.server";

/**
 * Every health check, group by group, for a person to read: bad, and 503,
 * when any is. The outside monitors each ask one group's address
 * (app/api/health/[kind]/[group]).
 */
export async function GET() {
  const at = now();
  const groups = await checkAllHealth(at);
  const status = groups.some((group) => group.status === "bad") ? "bad" : "ok";
  return NextResponse.json(
    { status, checkedAt: at.toISOString(), groups },
    { status: HEALTH_HTTP_STATUS[status], headers: { "Cache-Control": "no-store" } },
  );
}

export { GET as HEAD };
