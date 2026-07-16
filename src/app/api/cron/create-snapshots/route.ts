import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/api/cron-auth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { createDailySnapshot } from "@/lib/services/snapshot-service";
import { startOfDay } from "@/lib/utils/dates";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  try {
    const asOf = startOfDay(new Date());
    const portfolios = await prisma.portfolio.findMany({ select: { id: true } });

    const results: Array<{ portfolioId: string; snapshotId: string }> = [];

    for (const portfolio of portfolios) {
      const { portfolioSnapshotId } = await createDailySnapshot(
        portfolio.id,
        asOf
      );
      results.push({ portfolioId: portfolio.id, snapshotId: portfolioSnapshotId });
    }

    return jsonOk({
      ok: true,
      date: asOf.toISOString(),
      processed: results.length,
      results,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
