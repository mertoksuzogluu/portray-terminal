import { prisma } from "@/lib/db/prisma";
import { getDefaultPortfolioId, requireUser } from "@/lib/auth/session";

export async function requirePortfolioContext() {
  const user = await requireUser();
  const portfolioId = await getDefaultPortfolioId(user.id);
  if (!portfolioId) {
    throw new Error("Portföy bulunamadı. Lütfen ayarlardan bir portföy oluşturun.");
  }
  return { user, portfolioId };
}

export async function getLatestPortfolioSnapshot(portfolioId: string) {
  return prisma.portfolioDailySnapshot.findFirst({
    where: { portfolioId },
    orderBy: { snapshotDate: "desc" },
  });
}

export async function getPortfolioSnapshots(
  portfolioId: string,
  days = 365
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return prisma.portfolioDailySnapshot.findMany({
    where: { portfolioId, snapshotDate: { gte: since } },
    orderBy: { snapshotDate: "asc" },
  });
}

export async function getLatestPositionSnapshots(portfolioId: string) {
  const latest = await prisma.positionDailySnapshot.findFirst({
    where: { portfolioId },
    orderBy: { snapshotDate: "desc" },
    select: { snapshotDate: true },
  });

  if (!latest) return [];

  return prisma.positionDailySnapshot.findMany({
    where: { portfolioId, snapshotDate: latest.snapshotDate },
    include: { asset: true },
    orderBy: { marketValue: "desc" },
  });
}
