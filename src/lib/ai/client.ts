/**
 * Minimal, provider-agnostic LLM client for the daily card scans.
 *
 * Two things shape this file:
 *
 * 1. Every scan MUST be web-grounded. The whole point is to learn what issuers changed
 *    this week, which is by definition outside any model's training data. An ungrounded
 *    answer here isn't merely unhelpful — it is a confident, plausible invention that
 *    would flow into the scoring engine and misroute real money. So each provider is
 *    wired with its native search tool, and a provider that can't search is not used.
 *
 * 2. No SDKs. The repo already talks to Supabase over plain fetch; three vendor SDKs to
 *    make one JSON call each would be the larger dependency.
 */

export type AiProvider = "anthropic" | "openai" | "gemini";

export type AiSource = { title: string; url: string };

export type AiResult = {
  provider: AiProvider;
  model: string;
  text: string;
  sources: AiSource[];
};

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "No AI provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY " +
        "in your Vercel environment variables."
    );
    this.name = "AiNotConfiguredError";
  }
}

/** First provider with a key present. Order is preference, not capability. */
export function detectProvider(): { provider: AiProvider; key: string } | null {
  const a = process.env.ANTHROPIC_API_KEY;
  if (a) return { provider: "anthropic", key: a };
  const o = process.env.OPENAI_API_KEY;
  if (o) return { provider: "openai", key: o };
  const g = process.env.GEMINI_API_KEY;
  if (g) return { provider: "gemini", key: g };
  return null;
}

const MODELS: Record<AiProvider, string> = {
  anthropic: process.env.AI_MODEL || "claude-sonnet-4-5",
  openai: process.env.AI_MODEL || "gpt-5",
  gemini: process.env.AI_MODEL || "gemini-2.5-pro",
};

function dedupeSources(sources: AiSource[]): AiSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (!s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

async function callAnthropic(key: string, prompt: string, maxSearches: number): Promise<AiResult> {
  const model = MODELS.anthropic;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = await res.json();

  let text = "";
  const sources: AiSource[] = [];
  for (const block of json.content ?? []) {
    if (block.type === "text") text += block.text;
    // Search results arrive as their own blocks; the citations are what we keep, so a
    // reviewer can click through to the issuer page rather than trusting the summary.
    if (block.type === "web_search_tool_result") {
      for (const r of block.content ?? []) {
        if (r.url) sources.push({ title: r.title || r.url, url: r.url });
      }
    }
  }
  return { provider: "anthropic", model, text, sources: dedupeSources(sources) };
}

async function callOpenAi(key: string, prompt: string): Promise<AiResult> {
  const model = MODELS.openai;
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, tools: [{ type: "web_search" }], input: prompt }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = await res.json();

  let text = json.output_text ?? "";
  const sources: AiSource[] = [];
  for (const item of json.output ?? []) {
    for (const c of item.content ?? []) {
      if (!text && c.type === "output_text") text += c.text ?? "";
      for (const ann of c.annotations ?? []) {
        if (ann.url) sources.push({ title: ann.title || ann.url, url: ann.url });
      }
    }
  }
  return { provider: "openai", model, text, sources: dedupeSources(sources) };
}

async function callGemini(key: string, prompt: string): Promise<AiResult> {
  const model = MODELS.gemini;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = await res.json();

  const cand = json.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  const sources: AiSource[] = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c: { web?: { uri?: string; title?: string } }) => ({
      title: c.web?.title || c.web?.uri || "",
      url: c.web?.uri || "",
    }))
    .filter((s: AiSource) => s.url);

  return { provider: "gemini", model, text, sources: dedupeSources(sources) };
}

/** Runs one grounded prompt against whichever provider is configured. */
export async function askGrounded(prompt: string, maxSearches = 8): Promise<AiResult> {
  const found = detectProvider();
  if (!found) throw new AiNotConfiguredError();
  switch (found.provider) {
    case "anthropic":
      return callAnthropic(found.key, prompt, maxSearches);
    case "openai":
      return callOpenAi(found.key, prompt);
    case "gemini":
      return callGemini(found.key, prompt);
  }
}

/**
 * Pulls the first JSON array or object out of a model response.
 *
 * Even under firm instructions models wrap JSON in prose or a ```json fence, and a scan
 * that threw on a stray "Here's what I found:" would fail for a reason that has nothing
 * to do with the data.
 */
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text].filter(Boolean) as string[];
  for (const c of candidates) {
    const start = c.search(/[[{]/);
    if (start < 0) continue;
    const open = c[start];
    const close = open === "[" ? "]" : "}";
    const end = c.lastIndexOf(close);
    if (end <= start) continue;
    try {
      return JSON.parse(c.slice(start, end + 1)) as T;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}
