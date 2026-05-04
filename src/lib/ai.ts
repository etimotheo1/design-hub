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

export type ExpandStyle = "default" | "concise" | "detailed" | "customer" | "technical" | "strategic";

export interface ExpandInput {
  title: string;
  imagined?: string;
  project?: string;
  style?: ExpandStyle;
}

export interface ExpandResult {
  expansion: string;
}

// Style-specific tweaks to the system prompt. Each one changes length, focus,
// or angle — but the core "stay grounded, use sections, no invented specifics"
// rules are preserved.
function styleInstructions(style: ExpandStyle): { length: string; focus: string; structure: string } {
  switch (style) {
    case "concise":
      return {
        length: "Keep it tight: 60–90 words total. Two or three short paragraphs, no headings unless essential.",
        focus: "Get to the point. Capture the experience and the success signal — skip considerations unless critical.",
        structure: "No headings required; flowing prose is fine.",
      };
    case "detailed":
      return {
        length: "Aim for 300–400 words. Use the full structure with substantive content under each heading.",
        focus: "Cover edge cases, dependencies, and risks. Include subtle considerations that might affect design or build.",
        structure: "Full structure: ## Who benefits, ## Imagined experience, ## Success signals, ## Considerations, ## Open questions.",
      };
    case "customer":
      return {
        length: "Around 150–200 words.",
        focus: "Lean into the customer/user perspective — how they feel before, the specific moment things change for them, what they'll say to a friend.",
        structure: "Use ## Customer pain today, ## What changes for them, ## Words they'd use, ## Risks to watch.",
      };
    case "technical":
      return {
        length: "Around 200–280 words.",
        focus: "Practical implementation lens (without inventing architecture). Surface tech constraints, integration points, data needs.",
        structure: "Use ## Outcome, ## Likely surface area, ## Data & integrations, ## Risks & constraints, ## Open questions.",
      };
    case "strategic":
      return {
        length: "Around 150–200 words.",
        focus: "Frame it for executives. Why now, business impact, fit with priorities, what success looks like at the company level.",
        structure: "Use ## The strategic bet, ## Why now, ## Business impact, ## Risks if we don't act, ## Decision needed.",
      };
    default: // "default"
      return {
        length: "Total length around 150–250 words. Use short bullet points within sections where helpful.",
        focus: "Cover who benefits, imagined experience, success signals, considerations, and open questions.",
        structure: "Use ## Who benefits, ## Imagined experience, ## Success signals, ## Considerations, ## Open questions.",
      };
  }
}

export async function expandIdea(input: ExpandInput): Promise<{ ok: boolean; result?: ExpandResult; error?: string }> {
  if (!isAIConfigured()) return { ok: false, error: "AI not configured" };
  if (!input.title.trim()) return { ok: false, error: "Empty title" };

  const style = input.style || "default";
  const instr = styleInstructions(style);

  const system = [
    "You expand brief design-thinking ideas into clearer briefings.",
    "Given a one-line idea and optional context, write a richer description that helps designers and engineers plan accurately.",
    instr.structure,
    instr.focus,
    instr.length,
    "Be specific to the idea provided; don't invent technical details that weren't in the input.",
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

export interface SuggestDesignationsInput {
  existing: string[];   // designations already in the system (we won't suggest these again)
  orgContext?: string;  // optional: brief description of the org / team
}

export interface SuggestDesignationsResult {
  designations: { name: string; reason: string }[];
}

export async function suggestDesignations(
  input: SuggestDesignationsInput
): Promise<{ ok: boolean; result?: SuggestDesignationsResult; error?: string }> {
  if (!isAIConfigured()) return { ok: false, error: "AI not configured" };

  const system = [
    "You suggest job-title designations for a small-to-medium company's design-thinking pipeline tool.",
    "Designations are the roles that approve stage transitions on cards (e.g. 'Manager', 'Line Manager', 'CEO').",
    "Suggest 6 to 10 designations that would be useful for a typical company, biased toward roles that have approval authority.",
    "Avoid suggesting designations that are already in the existing list (case-insensitive).",
    "Each designation should be a short noun phrase (1–3 words), Title Case.",
    'Respond ONLY with JSON: {"designations":[{"name":"...","reason":"one short phrase"}, ...]}. No code fences, no prose.',
  ].join(" ");

  const userMsg = [
    `Existing designations (skip these): ${input.existing.join(", ") || "(none yet)"}`,
    input.orgContext ? `Organisation context: ${input.orgContext}` : "Organisation context: small/mid-size company with technology, operations, and business teams.",
  ].join("\n");

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
        max_tokens: 400,
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
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, error: "No JSON in model response" };

    const parsed = JSON.parse(m[0]) as { designations?: Array<{ name?: string; reason?: string }> };
    const existingLower = new Set(input.existing.map((s) => s.toLowerCase()));
    const designations = (parsed.designations ?? [])
      .map((d) => ({
        name: typeof d.name === "string" ? d.name.trim() : "",
        reason: typeof d.reason === "string" ? d.reason.trim() : "",
      }))
      .filter((d) => d.name && !existingLower.has(d.name.toLowerCase()));

    return { ok: true, result: { designations } };
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
