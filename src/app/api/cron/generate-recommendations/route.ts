import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/api/cron-auth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { runRecommendationsForAllPortfolios } from "@/lib/recommendations/service";
import { startOfDay } from "@/lib/utils/dates";

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  try {
    const result = await runRecommendationsForAllPortfolios(startOfDay(new Date()));
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
