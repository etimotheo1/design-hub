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

export interface ExpandInput {
  title: string;
  imagined?: string;
  project?: string;
}

export interface ExpandResult {
  expansion: string;
}

// Take a brief idea and expand it into a richer briefing that designers and
// engineers can plan against. We deliberately keep it grounded — no invented
// technical specifics, no generic boilerplate.
export async function expandIdea(input: ExpandInput): Promise<{ ok: boolean; result?: ExpandResult; error?: string }> {
  if (!isAIConfigured()) return { ok: false, error: "AI not configured" };
  if (!input.title.trim()) return { ok: false, error: "Empty title" };

  const system = [
    "You expand brief design-thinking ideas into clearer briefings.",
    "Given a one-line idea and optional context, write a richer description that helps designers and engineers plan accurately.",
    "Structure your response with these sections, using markdown headings:",
    "  ## Who benefits — who feels this change, in concrete terms",
    "  ## Imagined experience — what the end-state looks and feels like",
    "  ## Success signals — observable indicators that it's working",
    "  ## Considerations — constraints, risks, or dependencies worth flagging",
    "  ## Open questions — what needs clarification before designing",
    "Be specific to the idea provided; don't invent technical details that weren't in the input.",
    "Keep total length around 150–250 words. Use short bullet points within sections where helpful.",
    "Respond with the expanded text only — no preface, no JSON, no code fences, no surrounding quotes.",
  ].join("\n");

  const userMsg = [
    `Idea title: ${input.title}`,
    input.imagined ? `Current imagined outcome: ${input.imagined}` : "Current imagined outcome: (not yet written)",
    input.project ? `Project context: ${input.project}` : "",
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
        max_tokens: 600,
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
    if (!text.trim()) return { ok: false, error: "Empty response" };
    return { ok: true, result: { expansion: text.trim() } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI call failed" };
  }
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
