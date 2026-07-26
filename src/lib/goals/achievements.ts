import { prisma } from "@/lib/db/prisma";
import { ACHIEVEMENT_DEFS } from "./types";

/** Rozetleri portföy değerine göre aç — sadece GoalAchievement yazar, portföye dokunmaz. */
export async function syncAchievements(
  userId: string,
  currentValue: number,
  opts?: { investedCapital?: number | null; freedomReached?: boolean }
) {
  const unlocked: string[] = [];

  for (const def of ACHIEVEMENT_DEFS) {
    let shouldUnlock = false;
    if (def.code === "FIRST_100_RETURN") {
      const invested = opts?.investedCapital ?? 0;
      shouldUnlock = invested > 0 && currentValue >= invested * 2;
    } else if (def.code === "FINANCIAL_FREEDOM") {
      shouldUnlock = Boolean(opts?.freedomReached);
    } else if (def.threshold != null) {
      shouldUnlock = currentValue >= def.threshold;
    }

    if (!shouldUnlock) continue;

    try {
      await prisma.goalAchievement.upsert({
        where: { userId_code: { userId, code: def.code } },
        create: { userId, code: def.code },
        update: {},
      });
      unlocked.push(def.code);
    } catch {
      // race / unique — ignore
    }
  }

  const rows = await prisma.goalAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: "asc" },
  });

  return ACHIEVEMENT_DEFS.map((def) => {
    const row = rows.find((r) => r.code === def.code);
    return {
      code: def.code,
      label: def.label,
      unlocked: Boolean(row),
      unlockedAt: row?.unlockedAt.toISOString() ?? null,
    };
  });
}
