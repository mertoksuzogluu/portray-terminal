import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/api/cron-auth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { syncInflationData, syncMarketData } from "@/lib/services/market-sync";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  try {
    const market = await syncMarketData({ force: false });
    const inflation = await syncInflationData();

    return jsonOk({
      ok: true,
      market,
      inflationRecords: inflation,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
