import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { syncInflationData } from "@/lib/services/market-sync";
import { getInflationProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** TÜFE serisini listele. */
export async function GET() {
  try {
    await requireUser();
    const rows = await prisma.inflationIndex.findMany({
      where: { countryCode: "TR", indexType: "TUFE" },
      orderBy: { period: "desc" },
      take: 36,
    });

    const provider = getInflationProvider();
    return jsonOk({
      series: rows.map((r) => ({
        period: r.period,
        indexValue: Number(r.indexValue.toString()),
        monthlyRate: r.monthlyRate ? Number(r.monthlyRate.toString()) : null,
        annualRate: r.annualRate ? Number(r.annualRate.toString()) : null,
        source: r.source,
        fetchedAt: r.fetchedAt.toISOString(),
      })),
      providerConfigured: provider.isConfigured(),
      providerName: provider.name,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}

/** TÜFE senkronu: EVDS varsa canlı, yoksa resmi fallback. */
export async function POST() {
  try {
    await requireUser();
    const result = await syncInflationData();
    return jsonOk(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}
