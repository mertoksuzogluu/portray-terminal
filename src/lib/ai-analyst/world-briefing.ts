/**
 * OpenAI Responses API + web_search ile güncel piyasa / jeopolitik brifing.
 * Aylık rapor başına ~1 arama (~$0.01 + token).
 */

function sanitizeApiKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().replace(/^["']|["']$/g, "").trim();
  return key.length > 0 ? key : null;
}

function extractResponseText(data: unknown): string | null {
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

export async function fetchWorldMarketBriefing(params: {
  periodLabel: string;
  monthName: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{ briefing: string | null; error: string | null }> {
  const apiKey = sanitizeApiKey(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return { briefing: null, error: "OPENAI_API_KEY yok." };
  }

  const model = sanitizeApiKey(process.env.OPENAI_MODEL) || "gpt-4o-mini";

  const prompt = `Web’de araştır. Dönem: ${params.monthName} (${params.periodStart} – ${params.periodEnd}).

Türkiye’de bireysel yatırımcının portföyünü (fon, hisse, döviz, altın) etkileyebilecek
GÜNCEL ve SOMUT olayları yaz. Genel laflar yasak (“siyasi belirsizlik”, “jeopolitik risk” tek başına yetmez).

Her madde için şunu ver:
1) Ne oldu / ne bekleniyor? (ülke, aktör, tarih veya hafta)
2) Hangi varlık etkilenir? (BIST, USD/TRY, altın, petrol, faiz)
3) İyi senaryo / kötü senaryo (ör. savaş alevlenirse petrol yükselir, risk iştahı düşer)

Kapsam örnekleri (varsa gerçekleri yaz, uydurma):
- ABD–İran / Orta Doğu gerilimi, Hürmüz, petrol
- Fed / ECB faiz, ABD istihdam
- TCMB faiz, enflasyon, Türkiye siyaseti
- Çin / Avrupa büyüme, riskli varlıklar
- Büyük şirket veya emtia şokları

Türkçe, sade dil, 5–7 madde. Madde madde numaralandır.`;

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
      // web_search yoksa / kota: sessizce null — ana anlatım yine çalışır
      return {
        briefing: null,
        error: `Dünya brifingi alınamadı (${res.status}): ${detail}`,
      };
    }

    const data: unknown = await res.json();
    const text = extractResponseText(data);
    if (!text) {
      return { briefing: null, error: "Dünya brifingi boş döndü." };
    }
    return { briefing: text, error: null };
  } catch (err) {
    return {
      briefing: null,
      error:
        err instanceof Error
          ? `Dünya brifingi hatası: ${err.message}`
          : "Dünya brifingi hatası.",
    };
  }
}
