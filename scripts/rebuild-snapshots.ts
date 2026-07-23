/**
 * One-off: rebuild portfolio snapshots from a start date.
 * Usage: DATABASE_URL=... npx tsx scripts/rebuild-snapshots.ts [portfolioId] [YYYY-MM-DD]
 */
import { prisma } from "../src/lib/db/prisma";
import { rebuildSnapshotsFrom } from "../src/lib/services/snapshot-service";
import { parseDateKey } from "../src/lib/utils/dates";

async function main() {
  const portfolioId = process.argv[2];
  const fromKey = process.argv[3] ?? "2026-07-01";
  if (!portfolioId) {
    const all = await prisma.portfolio.findMany({ select: { id: true, name: true } });
    console.log("Portfolios:", all);
    throw new Error("Usage: npx tsx scripts/rebuild-snapshots.ts <portfolioId> [YYYY-MM-DD]");
  }
  const from = parseDateKey(fromKey);
  console.log("Rebuilding", portfolioId, "from", fromKey);
  const n = await rebuildSnapshotsFrom(portfolioId, from);
  const rows = await prisma.portfolioDailySnapshot.findMany({
    where: { portfolioId },
    orderBy: { snapshotDate: "asc" },
    select: {
      snapshotDate: true,
      dailyReturn: true,
      dailyProfitLoss: true,
      totalMarketValue: true,
    },
  });
  console.log("rebuilt days:", n);
  for (const r of rows) {
    console.log(
      r.snapshotDate.toISOString().slice(0, 10),
      "ret=",
      r.dailyReturn?.toString() ?? "null",
      "pnl=",
      r.dailyProfitLoss.toString()
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
