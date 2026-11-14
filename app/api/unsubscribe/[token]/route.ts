import { unsubscribeCopy } from "@/lib/supporters/email-settings";

// A mail app's own Unsubscribe button, by the List-Unsubscribe-Post header
// on every copy of a broadcast (RFC 8058): one POST, no page, which opts the
// address out of what the copy went under.

type Params = { params: Promise<{ token: string }> };

export async function POST(_request: Request, { params }: Params): Promise<Response> {
  const done = await unsubscribeCopy((await params).token, "list-unsubscribe");
  return new Response(null, { status: done ? 200 : 404 });
}
