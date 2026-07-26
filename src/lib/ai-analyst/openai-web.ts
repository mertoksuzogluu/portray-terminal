/** OpenAI Responses + web_search ortak yardımcılar */

export function sanitizeApiKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().replace(/^["']|["']$/g, "").trim();
  return key.length > 0 ? key : null;
}

export function extractResponseText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.output_text === "string" && obj.output_text.trim()) {
    return obj.output_text.trim();
  }
  const output = obj.output;
  if (!Array.isArray(output)) return null;
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type === "message" && Array.isArray(row.content)) {
      for (const c of row.content) {
        if (
          c &&
          typeof c === "object" &&
          (c as { type?: string }).type === "output_text" &&
          typeof (c as { text?: string }).text === "string"
        ) {
          chunks.push((c as { text: string }).text);
        }
      }
    }
  }
  const joined = chunks.join("\n").trim();
  return joined || null;
}

export async function openaiWebSearch(
  prompt: string
): Promise<{ text: string | null; error: string | null }> {
  const apiKey = sanitizeApiKey(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return { text: null, error: "OPENAI_API_KEY yok." };
  }
  const model = sanitizeApiKey(process.env.OPENAI_MODEL) || "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        tools: [{ type: "web_search" }],
        tool_choice: "required",
        input: prompt,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let detail = body.slice(0, 300);
      try {
        const j = JSON.parse(body) as { error?: { message?: string } };
        if (j.error?.message) detail = j.error.message;
      } catch {
        /* keep */
      }
      return { text: null, error: `OpenAI web arama (${res.status}): ${detail}` };
    }

    const data: unknown = await res.json();
    const text = extractResponseText(data);
    if (!text) return { text: null, error: "Web arama boş döndü." };
    return { text, error: null };
  } catch (err) {
    return {
      text: null,
      error:
        err instanceof Error
          ? `Web arama hatası: ${err.message}`
          : "Web arama hatası.",
    };
  }
}
