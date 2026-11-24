import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { LUMA_NOT_A_CONTACT, lumaList, lumaPost } from "./luma-api.server";
import { OutsideFailure } from "./outside-failure.server";

const LIST = "https://public-api.luma.com/v1/things/list";

describe("lumaList", () => {
  beforeEach(() => vi.stubEnv("LUMA_API_KEY", "k"));
  afterEach(() => vi.unstubAllEnvs());

  it("fetches a page with the key and the params, and reads the cursor and the rate limit", async () => {
    let request: Request | undefined;
    server.use(
      http.get(LIST, ({ request: r }) => {
        request = r;
        return HttpResponse.json(
          { entries: [1, 2], has_more: true, next_cursor: "c2" },
          { headers: { "x-ratelimit-remaining": "150" } },
        );
      }),
    );
    const page = await lumaList<number>("/v1/things/list", new URLSearchParams({ a: "1" }));
    expect(page).toEqual({ entries: [1, 2], nextCursor: "c2", remaining: 150 });
    expect(request!.headers.get("x-luma-api-key")).toBe("k");
    expect(new URL(request!.url).searchParams.get("a")).toBe("1");
  });

  it("throws an OutsideFailure for an answer that's ok but isn't JSON, as Luma failing", async () => {
    server.use(http.get(LIST, () => new HttpResponse("<html>Bad gateway</html>", { status: 200 })));
    const thrown = await lumaList("/v1/things/list", new URLSearchParams()).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(OutsideFailure);
    expect(thrown).toMatchObject({ service: "luma", kind: "refused", status: 200 });
  });

  it("gives no cursor on the last page, or when has_more comes without one, and no rate limit without the header", async () => {
    server.use(http.get(LIST, () => HttpResponse.json({ has_more: true })));
    expect(await lumaList("/v1/things/list", new URLSearchParams())).toEqual({
      entries: [],
      nextCursor: undefined,
      remaining: undefined,
    });
    server.use(http.get(LIST, () => HttpResponse.json({ entries: [1], has_more: false, next_cursor: "stale" })));
    expect((await lumaList("/v1/things/list", new URLSearchParams())).nextCursor).toBeUndefined();
  });

  it("asks Luma afresh each time, unless told how long Next may keep the answer", async () => {
    server.use(http.get(LIST, () => HttpResponse.json({ entries: [] })));
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await lumaList("/v1/things/list", new URLSearchParams());
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    await lumaList("/v1/things/list", new URLSearchParams(), 60);
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({ next: { revalidate: 60 } });
    expect(fetchSpy.mock.calls[1][1]).not.toHaveProperty("cache");
    fetchSpy.mockRestore();
  });

  it("says a 429 is a rate limit, with Luma's retry-after or a minute", async () => {
    server.use(http.get(LIST, () => new HttpResponse(null, { status: 429, headers: { "retry-after": "30" } })));
    await expect(lumaList("/v1/things/list", new URLSearchParams())).rejects.toMatchObject({ retryAfter: 30 });
    server.use(http.get(LIST, () => new HttpResponse(null, { status: 429 })));
    const error = await lumaList("/v1/things/list", new URLSearchParams()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OutsideFailure);
    expect(error).toMatchObject({ service: "luma", kind: "rate-limited", status: 429, retryAfter: 60 });
  });

  it("throws on any other answer that isn't ok, and without the key, without calling Luma", async () => {
    server.use(http.get(LIST, () => new HttpResponse(null, { status: 401 })));
    await expect(lumaList("/v1/things/list", new URLSearchParams())).rejects.toThrow("Luma answered 401");
    vi.stubEnv("LUMA_API_KEY", "");
    let called = false;
    server.use(
      http.get(LIST, () => {
        called = true;
        return HttpResponse.json({});
      }),
    );
    const unset = await lumaList("/v1/things/list", new URLSearchParams()).catch((e: unknown) => e);
    expect(unset).toMatchObject({ kind: "unauthorised", status: 0, message: "LUMA_API_KEY is not set" });
    expect(called).toBe(false);
  });
});

describe("lumaPost", () => {
  const POST = "https://public-api.luma.com/v1/things/do";
  beforeEach(() => vi.stubEnv("LUMA_API_KEY", "k"));
  afterEach(() => vi.unstubAllEnvs());

  it("sends the body with the key, and gives Luma's answer", async () => {
    let sent: unknown;
    let key: string | null = null;
    server.use(
      http.post(POST, async ({ request }) => {
        sent = await request.json();
        key = request.headers.get("x-luma-api-key");
        return HttpResponse.json({ done: true });
      }),
    );
    await expect(lumaPost("/v1/things/do", { a: 1 })).resolves.toEqual({ done: true });
    expect(sent).toEqual({ a: 1 });
    expect(key).toBeTruthy();
  });

  it("throws an OutsideFailure for an answer that's ok but isn't JSON, as Luma failing", async () => {
    server.use(http.post(POST, () => new HttpResponse("<html>Bad gateway</html>", { status: 200 })));
    const thrown = await lumaPost("/v1/things/do", {}).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(OutsideFailure);
    expect(thrown).toMatchObject({ service: "luma", kind: "refused", status: 200 });
  });

  it("throws on a 429, with Luma's retry-after or a minute, on any other refusal, and without the key", async () => {
    server.use(http.post(POST, () => new HttpResponse(null, { status: 429, headers: { "retry-after": "30" } })));
    await expect(lumaPost("/v1/things/do", {})).rejects.toMatchObject({ retryAfter: 30 });
    server.use(http.post(POST, () => new HttpResponse(null, { status: 429 })));
    await expect(lumaPost("/v1/things/do", {})).rejects.toMatchObject({ retryAfter: 60 });
    server.use(http.post(POST, () => new HttpResponse(null, { status: 500 })));
    await expect(lumaPost("/v1/things/do", {})).rejects.toThrow("Luma answered 500");
    vi.stubEnv("LUMA_API_KEY", "");
    await expect(lumaPost("/v1/things/do", {})).rejects.toThrow("LUMA_API_KEY is not set");
  });

  it("gives a refusal's status, and Luma's message when its answer has one", async () => {
    server.use(http.post(POST, () => HttpResponse.json({ message: "No such thing." }, { status: 404 })));
    const error = await lumaPost("/v1/things/do", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OutsideFailure);
    expect(error).toMatchObject({ kind: "not-found", status: 404, said: "No such thing.", serviceCode: undefined });
    expect((error as Error).message).toBe("Luma answered 404 for /v1/things/do: No such thing.");
    server.use(http.post(POST, () => HttpResponse.json({ message: { text: "odd" } }, { status: 400 })));
    expect(await lumaPost("/v1/things/do", {}).catch((e: unknown) => e)).toMatchObject({
      kind: "refused",
      status: 400,
      said: undefined,
      message: "Luma answered 400 for /v1/things/do",
    });
    // A 404 whose message says the address isn't a contact has a code of its own, so nothing reads the message.
    const notAContact = { message: "We couldn’t find that contact." };
    server.use(http.post(POST, () => HttpResponse.json(notAContact, { status: 404 })));
    expect(await lumaPost("/v1/things/do", {}).catch((e: unknown) => e)).toMatchObject({
      kind: "not-found",
      serviceCode: LUMA_NOT_A_CONTACT,
    });
  });
});
