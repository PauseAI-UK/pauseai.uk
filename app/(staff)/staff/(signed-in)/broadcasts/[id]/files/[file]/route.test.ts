import { beforeEach, expect, it, vi } from "vitest";
import { query } from "@/lib/server/db.server";
import { addAttachment, createDraft } from "@/lib/mailings/drafts.server";
import { createBroadcastDraft } from "@/lib/broadcasts/drafts.server";
import { createSession } from "@/lib/accounts/auth.server";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { expectRedirect, requestCookies } from "@/tests/next-headers";
import { GET } from "./route";

vi.mock("next/headers", () => import("@/tests/next-headers"));

const open = (id: string, file: string) =>
  GET(new Request(`https://pauseai.uk/staff/broadcasts/${id}/files/${file}`), {
    params: Promise.resolve({ id, file }),
  });

describeWithDatabase("GET /staff/broadcasts/[id]/files/[file]", () => {
  useTestDatabase();
  beforeEach(() => requestCookies.clear());

  it("gives one of a broadcast's files, and none of a mailing to politicians", async () => {
    requestCookies.set("staff_session", await createSession("jo@pauseai.uk"));
    await query("UPDATE staff_accounts SET permissions = ARRAY['supporters'] WHERE email = 'jo@pauseai.uk'");
    const id = (await createBroadcastDraft("jo@pauseai.uk", { contact: "email:newsletter:yes" }))!;
    const content = Buffer.from("%PDF-1.4");
    await addAttachment(id, 1, { filename: "Brief.pdf", contentType: "application/pdf", content });
    const res = await open(String(id), "1");
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(content);
    expect((await open("x", "1")).status).toBe(404);
    expect((await open(String(id), "x")).status).toBe(404);
    const { id: mailing } = await createDraft("jo@pauseai.uk", { list: "politicians", params: {} }, {});
    await addAttachment(mailing, 1, { filename: "Theirs.pdf", contentType: "application/pdf", content });
    expect((await open(String(mailing), "2")).status).toBe(404);
  });

  it("turns away anyone not logged in", async () => {
    expect(await expectRedirect(() => open("1", "1"))).toMatch(/^\/staff\/login/);
  });
});
