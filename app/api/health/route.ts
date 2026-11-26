import { type NextRequest, NextResponse } from "next/server";
import { now } from "@/lib/now";
import { HEALTH_HTTP_STATUS } from "@/lib/oversight/health";
import { checkAllHealth } from "@/lib/oversight/health.server";
import { nodeReport } from "@/lib/oversight/node-report.server";

/**
 * Every health check, group by group, for a person to read: bad, and 503,
 * when any is. The outside monitors each ask one group's address
 * (app/api/health/[kind]/[group]). With ?node=1 it also says how this
 * server's Node runs (lib/oversight/node-report.server.ts), which changes
 * nothing else in the answer.
 */
export async function GET(request: NextRequest) {
  const at = now();
  const groups = await checkAllHealth(at);
  const status = groups.some((group) => group.status === "bad") ? "bad" : "ok";
  const found = { status, checkedAt: at.toISOString(), groups };
  return NextResponse.json(
    request.nextUrl.searchParams.get("node") === "1" ? { ...found, node: nodeReport() } : found,
    {
      status: HEALTH_HTTP_STATUS[status],
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export { GET as HEAD };
