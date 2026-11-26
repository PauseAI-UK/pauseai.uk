import "server-only";
import { anthropicFake } from "@/lib/server/fixtures/fakes/anthropic";
import { config } from "@/lib/server/config.server";
import { notSet, OutsideFailure, outsideJson, refusal } from "./outside-failure.server";
import { outsideFetch, type Outside } from "./outside-fetch.server";

const ANTHROPIC: Outside = { service: "anthropic", fake: anthropicFake };

// Anthropic's Messages API, for Claude's judgement of the press survey's
// finds (lib/press/review.ts): one request, answered as JSON to a schema
// (structured outputs, `output_config.format`). It's asked here with fetch, through outsideFetch, as every outside
// service is, so a fixture build answers with its fake.

/**
 * Claude Haiku 5.5, the cheapest: the survey reads text, not photos, and
 * staff check every find, so the cheapest model is enough. Low effort, as
 * it sorts rather than reasons at length.
 */
export const CLAUDE_MODEL = "claude-haiku-5-5";

/**
 * For what's asked once and kept, where a steadier answer is worth more:
 * a news site's tier, which Haiku gave differently from one asking to the
 * next more often than Sonnet did.
 */
export const CAREFUL_MODEL = "claude-sonnet-5-5";

/** The API version every request names, in its anthropic-version header. */
const API_VERSION = "2026-10-21";

/** Enough for a verdict on each of a night's finds, with Claude's thinking, which counts towards it. */
const MAX_TOKENS = 16_000;

/** What Claude answers `prompt` with, under `system`, as JSON that matches `schema`; asked of `model`, else Haiku. */
export async function askClaude({
  system,
  prompt,
  schema,
  model = CLAUDE_MODEL,
}: {
  system: string;
  prompt: string;
  schema: object;
  model?: string;
}): Promise<unknown> {
  const key = config.anthropicApiKey;
  if (!key) throw notSet("anthropic", "ANTHROPIC_API_KEY");
  const res = await outsideFetch(ANTHROPIC, "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": API_VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { effort: "low", format: { type: "json_schema", schema } },
    }),
    cache: "no-store",
    retries: 2,
  });
  if (!res.ok) throw refusal("anthropic", res);
  const message = (await outsideJson("anthropic", res)) as {
    stop_reason?: string;
    content?: { type: string; text?: string }[];
  };
  // A refusal, or an answer cut short, isn't the JSON asked for.
  if (message.stop_reason !== "end_turn") {
    throw new OutsideFailure("anthropic", "refused", { message: `Claude stopped: ${message.stop_reason}` });
  }
  const text = message.content?.find((block) => block.type === "text")?.text ?? "";
  return outsideJson("anthropic", new Response(text));
}
