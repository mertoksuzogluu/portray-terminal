import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requirePortfolioContext } from "@/lib/api/portfolio-context";
import { jsonError, jsonOk } from "@/lib/api/response";

export async function GET() {
  try {
    const { portfolioId } = await requirePortfolioContext();

    const [rules, events] = await Promise.all([
      prisma.alertRule.findMany({
        where: { portfolioId },
        orderBy: { createdAt: "desc" },
        include: { asset: true },
      }),
      prisma.alertEvent.findMany({
        where: { alertRule: { portfolioId } },
        orderBy: { triggeredAt: "desc" },
        take: 50,
        include: { alertRule: { include: { asset: true } } },
      }),
    ]);

    return jsonOk({
      rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        alertType: r.alertType,
        threshold: Number(r.threshold.toString()),
        operator: r.comparisonOperator,
        isActive: r.isActive,
        asset: r.asset ? { symbol: r.asset.symbol, name: r.asset.name } : null,
      })),
      events: events.map((e) => ({
        id: e.id,
        message: e.message,
        currentValue: Number(e.currentValue.toString()),
        triggeredAt: e.triggeredAt.toISOString(),
        isRead: e.isRead,
        ruleName: e.alertRule.name,
        asset: e.alertRule.asset?.symbol ?? null,
      })),
      unreadCount: events.filter((e) => !e.isRead).length,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { portfolioId } = await requirePortfolioContext();
    const body = await req.json();
    const eventId = String(body.eventId ?? "");
    const isRead = Boolean(body.isRead);

    const event = await prisma.alertEvent.findFirst({
      where: { id: eventId, alertRule: { portfolioId } },
    });
    if (!event) {
      return jsonError(new Error("Uyarı bulunamadı."), 404);
    }

    await prisma.alertEvent.update({
      where: { id: eventId },
      data: { isRead },
    });

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
