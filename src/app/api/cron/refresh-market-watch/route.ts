import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/api/cron-auth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { pickWeeklyWatchSymbols } from "@/lib/data/market-watch-universe";
import {
  ensureWatchAssets,
} from "@/lib/services/market-opportunity";
import { syncHistoricalPrices } from "@/lib/services/historical-sync";
import { syncMarketData } from "@/lib/services/market-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Her Pazartesi: haftanın izleme hisselerini oluştur, geçmiş fiyat doldur, canlı fiyat çek.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  try {
    const weekly = pickWeeklyWatchSymbols({ stockCount: 6 });
    const idMap = await ensureWatchAssets(weekly.all);
    const assetIds = [...idMap.values()];

    const history = await syncHistoricalPrices({
      assetIds,
      years: 1,
      minPoints: 60,
    });

    let market: Awaited<ReturnType<typeof syncMarketData>> | null = null;
    try {
      market = await syncMarketData({ force: true });
    } catch {
      market = null;
    }

    return jsonOk({
      ok: true,
      weekKey: weekly.weekKey,
      symbols: weekly.all.map((s) => s.symbol),
      history,
      marketProcessed: market?.processed ?? 0,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
