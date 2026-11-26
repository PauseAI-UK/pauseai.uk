import { json, type Fake } from "../fake";

// Anthropic's Messages API, as the press survey asks Claude whether each
// find is coverage of us (lib/press/review.ts). It answers by what each
// find's passages say: PauseAI UK or PauseAI Global is ours, PauseAI US, the
// plain phrase or no mention isn't, and PauseAI not saying which is unclear.
// Asked about news sites (lib/press/sources.ts), it takes a wire for an
// aggregator (tier 4), a "Times" for international news (2), one called
// "Local" as unknown, and the rest as UK regional news (3);
// a site named as an outlet on the list is that outlet.

type Candidate = { id: string; page?: { excerpts: string[]; captions: string[] } };

function verdictFor({ id, page }: Candidate) {
  const text = [...(page?.excerpts ?? []), ...(page?.captions ?? [])].join(" ");
  if (/PauseAI UK/i.test(text)) return { id, verdict: "ours", org: "uk", reason: "A caption names PauseAI UK." };
  if (/PauseAI Global/i.test(text)) return { id, verdict: "ours", org: "global", reason: "It quotes PauseAI Global." };
  if (/PauseAI US/i.test(text)) return { id, verdict: "not ours", org: "us", reason: "It's about PauseAI US." };
  if (/\bPauseAI\b/.test(text))
    return { id, verdict: "unclear", org: "unclear", reason: "It doesn't say which PauseAI." };
  return { id, verdict: "not ours", org: "none", reason: "No mention of PauseAI, or only the phrase." };
}

type Source = { id: string; name: string; site: string };

function sourceFor({ id, name }: Source, outlets: string[]) {
  const kind = /wire/i.test(name)
    ? "aggregator"
    : /times/i.test(name)
      ? "international"
      : /local/i.test(name)
        ? "unknown"
        : "uk-regional";
  const sameAs = outlets.find((outlet) => outlet.toLowerCase() === name.toLowerCase()) ?? null;
  return { id, kind, sameAs, why: `Judged by the fake from its name, ${name}.` };
}

/** The answer to a question about news sites, as Claude gives it. */
function sourcesAnswer(content: string) {
  const outlets = JSON.parse(/<outlets>([\s\S]*?)<\/outlets>/.exec(content)?.[1] ?? "[]") as string[];
  const sources = JSON.parse(/<sources>([\s\S]*?)<\/sources>/.exec(content)?.[1] ?? "[]") as Source[];
  return { sources: sources.map((source) => sourceFor(source, outlets)) };
}

export const anthropicFake: Fake = ({ hostname, pathname }, init) => {
  if (hostname !== "api.anthropic.com" || pathname !== "/v1/messages") return undefined;
  const request = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
  if (request.messages[0].content.includes("<sources>")) {
    return json({
      type: "message",
      role: "assistant",
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(sourcesAnswer(request.messages[0].content)) }],
    });
  }
  const listed = /<candidates>([\s\S]*)<\/candidates>/.exec(request.messages[0].content)?.[1] ?? "[]";
  const verdicts = (JSON.parse(listed) as Candidate[]).map(verdictFor);
  return json({
    type: "message",
    role: "assistant",
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ verdicts }) }],
  });
};
