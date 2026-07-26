import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ProjectionResult } from "./types";

export interface CoachPayload {
  headlines: string[];
  recommendations: string[];
  ytdComment: string;
  source: "openai" | "template";
  aiError?: string;
}

export function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function getCachedCoach(
  goalId: string
): Promise<CoachPayload | null> {
  const weekKey = isoWeekKey();
  const cached = await prisma.goalCoachCache.findUnique({
    where: { goalId_weekKey: { goalId, weekKey } },
  });
  if (!cached?.payload) return null;
  return cached.payload as unknown as CoachPayload;
}

function sanitizeApiKey(value: string | undefined): string | null {
  if (!value) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export function buildTemplateCoach(
  projection: ProjectionResult,
  growth90dPct: number | null
): CoachPayload {
  const headlines: string[] = [];
  const recommendations: string[] = [];

  if (growth90dPct != null) {
    if (growth90dPct > 0.03) {
      headlines.push("Son 90 gündeki büyüme hızın arttı.");
    } else if (growth90dPct < -0.02) {
      headlines.push("Son aylarda büyüme yavaşladı.");
    } else {
      headlines.push("Son 90 günde büyüme hızın görece dengeli.");
    }
  }

  if (projection.aheadBehind.status === "ahead") {
    headlines.push(
      `Bu performans devam ederse hedef tarihine yaklaşık ${projection.aheadBehind.label.replace(" öndesin.", " erken ulaşabilirsin.")}`
    );
    recommendations.push(
      "Mevcut hızını korursan hedefe planlanandan erken ulaşman olası görünüyor."
    );
    recommendations.push(
      "Hedef tarihini değiştirmeden aylık yatırım planını biraz esnetebilecek güven marjın oluşmuş olabilir."
    );
  } else if (projection.aheadBehind.status === "behind") {
    headlines.push("Hedef tarihini korumak için yatırım planını gözden geçirebilirsin.");
    recommendations.push(
      "Aylık katkı veya beklenen getiri varsayımını What-if simülatöründe test edebilirsin."
    );
    recommendations.push(
      "Hedef tutarını veya tarihi güncellemek, planı gerçekçi tutmana yardımcı olabilir."
    );
  } else {
    headlines.push("Planla uyumlu ilerliyorsun.");
    recommendations.push("Mevcut katkı ve getiri varsayımlarını korumak yeterli görünebilir.");
  }

  recommendations.push(projection.ytd.comment);

  return {
    headlines: headlines.slice(0, 4),
    recommendations: recommendations.slice(0, 4),
    ytdComment: projection.ytd.comment,
    source: "template",
  };
}

async function callOpenAICoach(
  projection: ProjectionResult,
  growth90dPct: number | null,
  goalTitle: string
): Promise<CoachPayload> {
  const fallback = buildTemplateCoach(projection, growth90dPct);
  const apiKey = sanitizeApiKey(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return {
      ...fallback,
      aiError: "OPENAI_API_KEY yok — şablon yorum kullanıldı.",
    };
  }

  const model = sanitizeApiKey(process.env.OPENAI_MODEL) || "gpt-4o-mini";
  const system = `Sen bir hedef koçu asistanısın. Türkçe, sade, kısa yaz.
Yatırım tavsiyesi emri verme. JSON döndür:
{"headlines":["...","..."],"recommendations":["...","..."],"ytdComment":"..."}
En fazla 3 headline, 3 recommendation.`;

  const user = `Hedef: ${goalTitle}
İlerleme %: ${projection.progressPct.toFixed(1)}
Kalan: ${projection.remaining}
Plan tarihi: ${projection.plannedDate.toISOString().slice(0, 10)}
Tahmini: ${projection.estimatedDate?.toISOString().slice(0, 10) ?? "yok"}
Durum: ${projection.aheadBehind.status} — ${projection.aheadBehind.label}
YTD plan: ${projection.ytd.planned.toFixed(0)} / gerçekleşen: ${projection.ytd.actual.toFixed(0)}
90g büyüme oranı: ${growth90dPct == null ? "yok" : (growth90dPct * 100).toFixed(2) + "%"}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      return { ...fallback, aiError: `OpenAI ${res.status}` };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CoachPayload>;
    return {
      headlines: Array.isArray(parsed.headlines)
        ? parsed.headlines.map(String).slice(0, 4)
        : fallback.headlines,
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(String).slice(0, 4)
        : fallback.recommendations,
      ytdComment: String(parsed.ytdComment ?? fallback.ytdComment),
      source: "openai",
    };
  } catch (e) {
    return {
      ...fallback,
      aiError: e instanceof Error ? e.message : "AI hatası",
    };
  }
}

export async function getOrCreateCoach(
  goalId: string,
  goalTitle: string,
  projection: ProjectionResult,
  growth90dPct: number | null,
  force = false
): Promise<CoachPayload> {
  const weekKey = isoWeekKey();
  if (!force) {
    const cached = await prisma.goalCoachCache.findUnique({
      where: { goalId_weekKey: { goalId, weekKey } },
    });
    if (cached?.payload) {
      return cached.payload as unknown as CoachPayload;
    }
  }

  const payload = await callOpenAICoach(projection, growth90dPct, goalTitle);

  const json = payload as unknown as Prisma.InputJsonValue;
  await prisma.goalCoachCache.upsert({
    where: { goalId_weekKey: { goalId, weekKey } },
    create: { goalId, weekKey, payload: json },
    update: { payload: json },
  });

  return payload;
}
