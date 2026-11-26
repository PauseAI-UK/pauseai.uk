import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { askClaude, CAREFUL_MODEL, CLAUDE_MODEL } from "./anthropic.server";

const MESSAGES = "https://api.anthropic.com/v1/messages";

/** A question with no candidates in it, which the fake answers with no verdicts. */
const QUESTION = { system: "Judge each find.", prompt: "<candidates>[]</candidates>", schema: { type: "object" } };

beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", "key"));
afterEach(() => vi.unstubAllEnvs());

/** Claude's message, with these fields, answering the request. */
const answering = (message: object) => http.post(MESSAGES, () => HttpResponse.json(message));

describe("askClaude", () => {
  it("asks with our key, the model, the system prompt and the schema, and gives Claude's JSON", async () => {
    let asked: { key: string | null; body: Record<string, unknown> } | undefined;
    server.use(
      http.post(MESSAGES, async ({ request }) => {
        asked = { key: request.headers.get("x-api-key"), body: (await request.json()) as Record<string, unknown> };
        return HttpResponse.json({
          stop_reason: "end_turn",
          content: [{ type: "thinking" }, { type: "text", text: '{"verdicts":[1]}' }],
        });
      }),
    );
    expect(await askClaude(QUESTION)).toEqual({ verdicts: [1] });
    expect(asked?.key).toBe("key");
    expect(asked?.body).toMatchObject({
      model: CLAUDE_MODEL,
      system: "Judge each find.",
      messages: [{ role: "user", content: QUESTION.prompt }],
      output_config: { format: { type: "json_schema", schema: { type: "object" } } },
    });
  });

  it("asks the model it's given, rather than Haiku", async () => {
    let model: unknown;
    server.use(
      http.post(MESSAGES, async ({ request }) => {
        ({ model } = (await request.json()) as { model: unknown });
        return HttpResponse.json({ stop_reason: "end_turn", content: [{ type: "text", text: "{}" }] });
      }),
    );
    await askClaude({ ...QUESTION, model: CAREFUL_MODEL });
    expect(model).toBe(CAREFUL_MODEL);
    expect(CAREFUL_MODEL).not.toBe(CLAUDE_MODEL);
  });

  it("is answered by the fake when no test says otherwise", async () => {
    expect(await askClaude(QUESTION)).toEqual({ verdicts: [] });
  });

  it("asks nothing without a key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    let asked = 0;
    server.use(
      http.post(MESSAGES, () => {
        asked++;
        return HttpResponse.json({});
      }),
    );
    await expect(askClaude(QUESTION)).rejects.toMatchObject({ service: "anthropic", kind: "unauthorised" });
    expect(asked).toBe(0);
  });

  it("fails as the status says when Anthropic refuses", async () => {
    server.use(http.post(MESSAGES, () => HttpResponse.json({ error: "bad key" }, { status: 401 })));
    await expect(askClaude(QUESTION)).rejects.toMatchObject({ service: "anthropic", kind: "unauthorised" });
  });

  it("is refused when Claude stops other than at the end of its turn, as a refusal or an answer cut short", async () => {
    server.use(answering({ stop_reason: "max_tokens", content: [{ type: "text", text: '{"verdicts":' }] }));
    await expect(askClaude(QUESTION)).rejects.toMatchObject({ service: "anthropic", kind: "refused" });
    server.use(answering({ content: [] }));
    await expect(askClaude(QUESTION)).rejects.toMatchObject({ service: "anthropic", kind: "refused" });
  });

  it("is refused when the answer has no text, or text that isn't JSON", async () => {
    for (const content of [
      undefined,
      [],
      [{ type: "thinking" }],
      [{ type: "text" }],
      [{ type: "text", text: "No." }],
    ]) {
      server.use(answering({ stop_reason: "end_turn", content }));
      await expect(askClaude(QUESTION)).rejects.toMatchObject({ service: "anthropic", kind: "refused" });
    }
  });
});
