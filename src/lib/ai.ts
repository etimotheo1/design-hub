// Anthropic-backed taxonomy suggestion. Activates only when ANTHROPIC_API_KEY
// is set. We use direct fetch (no SDK dependency) and the cheap, fast Haiku
// model — suggestions should be near-instant and cost fractions of a cent each.

export interface SuggestInput {
  title: string;
  imagined?: string;
  categories: string[]; // names of available, non-archived categories
  cardTypes: string[];  // names of available, non-archived types
}

export interface SuggestResult {
  category: string | null;
  card_type: string | null;
  reason?: string;
}

export function isAIConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function suggestTaxonomy(input: SuggestInput): Promise<{ ok: boolean; suggestion?: SuggestResult; error?: string }> {
  if (!isAIConfigured()) return { ok: false, error: "AI not configured" };
  if (!input.title.trim()) return { ok: false, error: "Empty title" };
  if (input.categories.length === 0 && input.cardTypes.length === 0) {
    return { ok: false, error: "No taxonomy to choose from" };
  }

  const system = [
    "You classify business ideas for a design-thinking pipeline tool.",
    "Given the user's idea (title and optional imagined-outcome description), pick exactly one Category and one Type from the supplied lists.",
    "If a value really doesn't fit any option, return null for that field. Don't invent new options.",
    'Respond ONLY with a single JSON object: {"category": "<name or null>", "card_type": "<name or null>", "reason": "<one short phrase>"}. No prose, no code fences.',
  ].join(" ");

  const userMsg = [
    `Idea title: ${input.title}`,
    input.imagined ? `Imagined outcome: ${input.imagined}` : "",
    "",
    `Categories: ${input.categories.join(", ") || "(none)"}`,
    `Types: ${input.cardTypes.join(", ") || "(none)"}`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Anthropic ${res.status}: ${body.slice(0, 200)}` };
    }
    const json = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "";
    // Extract first JSON object — robust to a stray prefix.
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: "No JSON in model response" };

    const parsed = JSON.parse(m[0]) as { category?: string | null; card_type?: string | null; reason?: string };
    // Validate against the allowed lists; reject unknown values.
    const cat = typeof parsed.category === "string" && input.categories.includes(parsed.category) ? parsed.category : null;
    const typ = typeof parsed.card_type === "string" && input.cardTypes.includes(parsed.card_type) ? parsed.card_type : null;

    return { ok: true, suggestion: { category: cat, card_type: typ, reason: parsed.reason } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI call failed" };
  }
}
