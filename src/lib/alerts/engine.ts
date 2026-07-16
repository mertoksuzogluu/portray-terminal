import { subDays } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calculations/decimal";
import { calculateDrawdown } from "@/lib/calculations/risk";
import { arithmeticMean } from "@/lib/calculations/returns";
import { formatPercentPlain, formatMoney } from "@/lib/format/tr";
import { startOfDay } from "@/lib/utils/dates";
import { buildPortfolioAnalysisContext } from "@/lib/insights/engine";
import type {
  AlertEngineResult,
  AlertEvaluationContext,
  AlertEvaluator,
  AlertRuleRecord,
  NotificationService,
  TriggeredAlert,
} from "./types";
import { NoOpNotificationService } from "./types";

function dec(value: ReturnType<typeof d>): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(8));
}

function compare(
  operator: AlertRuleRecord["comparisonOperator"],
  current: ReturnType<typeof d>,
  threshold: ReturnType<typeof d>,
  previous?: ReturnType<typeof d> | null
): boolean {
  switch (operator) {
    case "GREATER_THAN":
      return current.gt(threshold);
    case "GREATER_THAN_OR_EQUAL":
      return current.gte(threshold);
    case "LESS_THAN":
      return current.lt(threshold);
    case "LESS_THAN_OR_EQUAL":
      return current.lte(threshold);
    case "CROSSES_ABOVE":
      return (
        previous !== null &&
        previous !== undefined &&
        previous.lte(threshold) &&
        current.gt(threshold)
      );
    case "CROSSES_BELOW":
      return (
        previous !== null &&
        previous !== undefined &&
        previous.gte(threshold) &&
        current.lt(threshold)
      );
    default:
      return false;
  }
}

function latestSnapshot(context: AlertEvaluationContext) {
  return context.snapshots.at(-1) ?? null;
}

const evaluators: AlertEvaluator[] = [
  {
    alertType: "PORTFOLIO_DAILY_LOSS",
    evaluate(rule, context) {
      const snap = latestSnapshot(context);
      if (!snap || snap.dailyReturn === null) return null;
      const loss = snap.dailyReturn.abs();
      const isLoss = snap.dailyReturn.lt(0);
      const threshold = d(rule.threshold);
      if (!isLoss || !compare(rule.comparisonOperator, loss, threshold)) {
        return null;
      }
      return {
        alertRuleId: rule.id,
        currentValue: snap.dailyReturn,
        message: `Portföy günlük kaybı ${formatPercentPlain(loss)} eşiği (${formatPercentPlain(threshold)}) aştı.`,
      };
    },
  },
  {
    alertType: "PORTFOLIO_DRAWDOWN",
    evaluate(rule, context) {
      if (context.snapshots.length < 2) return null;
      const dd = calculateDrawdown(
        context.snapshots.map((s) => ({
          date: s.snapshotDate,
          value: s.totalMarketValue,
        }))
      );
      const current = dd.currentDrawdown;
      if (current === null) return null;
      const threshold = d(rule.threshold);
      if (!compare(rule.comparisonOperator, current, threshold)) return null;
      return {
        alertRuleId: rule.id,
        currentValue: current,
        message: `Portföy drawdown ${formatPercentPlain(current)} seviyesine ulaştı (eşik ${formatPercentPlain(threshold)}).`,
      };
    },
  },
  {
    alertType: "ASSET_DAILY_RETURN",
    evaluate(rule, context) {
      if (!rule.assetId) return null;
      const snap = latestSnapshot(context);
      if (!snap) return null;
      const pos = context.positionSnapshots.find(
        (p) =>
          p.assetId === rule.assetId &&
          p.snapshotDate.getTime() === snap.snapshotDate.getTime()
      );
      if (!pos || pos.dailyReturn === null) return null;
      const threshold = d(rule.threshold);
      if (!compare(rule.comparisonOperator, pos.dailyReturn, threshold)) {
        return null;
      }
      const symbol = context.assetSymbols.get(rule.assetId) ?? rule.assetId;
      return {
        alertRuleId: rule.id,
        currentValue: pos.dailyReturn,
        message: `${symbol} günlük getirisi ${formatPercentPlain(pos.dailyReturn)} (eşik ${formatPercentPlain(threshold)}).`,
      };
    },
  },
  {
    alertType: "ASSET_AVG_DAILY_RETURN",
    evaluate(rule, context) {
      if (!rule.assetId) return null;
      const lookback = rule.lookbackDays ?? 7;
      const start = subDays(context.asOf, lookback);
      const returns = context.positionSnapshots
        .filter(
          (p) =>
            p.assetId === rule.assetId &&
            p.snapshotDate.getTime() >= start.getTime() &&
            p.dailyReturn !== null
        )
        .map((p) => p.dailyReturn!);
      if (returns.length < 2) return null;
      const avg = arithmeticMean(returns);
      if (avg === null) return null;
      const threshold = d(rule.threshold);
      if (!compare(rule.comparisonOperator, avg, threshold)) return null;
      const symbol = context.assetSymbols.get(rule.assetId) ?? rule.assetId;
      return {
        alertRuleId: rule.id,
        currentValue: avg,
        message: `${symbol} son ${lookback} gün ortalama günlük getirisi ${formatPercentPlain(avg)} (eşik ${formatPercentPlain(threshold)}).`,
      };
    },
  },
  {
    alertType: "ASSET_WEIGHT",
    evaluate(rule, context) {
      if (!rule.assetId) return null;
      const snap = latestSnapshot(context);
      if (!snap) return null;
      const pos = context.positionSnapshots.find(
        (p) =>
          p.assetId === rule.assetId &&
          p.snapshotDate.getTime() === snap.snapshotDate.getTime()
      );
      if (!pos || pos.portfolioWeight === null) return null;
      const threshold = d(rule.threshold);
      if (!compare(rule.comparisonOperator, pos.portfolioWeight, threshold)) {
        return null;
      }
      const symbol = context.assetSymbols.get(rule.assetId) ?? rule.assetId;
      return {
        alertRuleId: rule.id,
        currentValue: pos.portfolioWeight,
        message: `${symbol} portföy ağırlığı ${formatPercentPlain(pos.portfolioWeight)} (eşik ${formatPercentPlain(threshold)}).`,
      };
    },
  },
  {
    alertType: "MONTHLY_REAL_RETURN_NEGATIVE",
    evaluate(rule, context) {
      const snap = latestSnapshot(context);
      if (!snap || snap.realReturn === null) return null;
      const threshold = d(rule.threshold);
      if (!compare(rule.comparisonOperator, snap.realReturn, threshold)) {
        return null;
      }
      return {
        alertRuleId: rule.id,
        currentValue: snap.realReturn,
        message: `Reel getiri ${formatPercentPlain(snap.realReturn)} seviyesinde (eşik ${formatPercentPlain(threshold)}).`,
      };
    },
  },
  {
    alertType: "ASSET_PRICE",
    evaluate(rule, context) {
      if (!rule.assetId) return null;
      const priceInfo = context.assetPrices.get(rule.assetId);
      if (!priceInfo) return null;
      const threshold = d(rule.threshold);
      if (!compare(rule.comparisonOperator, priceInfo.price, threshold)) {
        return null;
      }
      const symbol = context.assetSymbols.get(rule.assetId) ?? rule.assetId;
      return {
        alertRuleId: rule.id,
        currentValue: priceInfo.price,
        message: `${symbol} fiyatı ${formatMoney(priceInfo.price)} (eşik ${formatMoney(threshold)}).`,
      };
    },
  },
  {
    alertType: "DATA_STALE",
    evaluate(rule, context) {
      if (!rule.assetId) return null;
      const priceInfo = context.assetPrices.get(rule.assetId);
      if (!priceInfo) return null;
      const ageMs = context.asOf.getTime() - priceInfo.fetchedAt.getTime();
      const ageDays = d(ageMs).div(1000 * 60 * 60 * 24);
      const threshold = d(rule.threshold);
      if (!compare(rule.comparisonOperator, ageDays, threshold)) return null;
      const symbol = context.assetSymbols.get(rule.assetId) ?? rule.assetId;
      return {
        alertRuleId: rule.id,
        currentValue: ageDays,
        message: `${symbol} fiyat verisi ${ageDays.toFixed(1)} gündür güncellenmedi (eşik ${threshold.toFixed(1)} gün).`,
      };
    },
  },
];

const evaluatorByType = new Map(
  evaluators.map((e) => [e.alertType, e] as const)
);

export async function buildAlertEvaluationContext(
  portfolioId: string,
  asOf: Date = new Date()
): Promise<AlertEvaluationContext | null> {
  const analysisContext = await buildPortfolioAnalysisContext(
    portfolioId,
    asOf
  );
  if (!analysisContext) return null;

  const assetIds = [
    ...new Set(analysisContext.positionSnapshots.map((p) => p.assetId)),
  ];
  const prices = assetIds.length
    ? await prisma.assetPrice.findMany({
        where: { assetId: { in: assetIds } },
        orderBy: [{ priceDate: "desc" }, { fetchedAt: "desc" }],
      })
    : [];

  const assetPrices = new Map<
    string,
    { price: ReturnType<typeof d>; priceDate: Date; fetchedAt: Date; dataQuality: string }
  >();
  const assetSymbols = new Map<string, string>();

  for (const p of analysisContext.positionSnapshots) {
    assetSymbols.set(p.assetId, p.symbol);
  }

  for (const price of prices) {
    if (!assetPrices.has(price.assetId)) {
      assetPrices.set(price.assetId, {
        price: d(price.close.toString()),
        priceDate: price.priceDate,
        fetchedAt: price.fetchedAt,
        dataQuality: price.dataQuality,
      });
    }
  }

  return {
    portfolioId,
    asOf: analysisContext.asOf,
    snapshots: analysisContext.snapshots,
    positionSnapshots: analysisContext.positionSnapshots,
    assetPrices,
    assetSymbols,
  };
}

function mapRule(row: {
  id: string;
  portfolioId: string;
  assetId: string | null;
  name: string;
  alertType: AlertRuleRecord["alertType"];
  comparisonOperator: AlertRuleRecord["comparisonOperator"];
  threshold: Prisma.Decimal;
  lookbackDays: number | null;
  isActive: boolean;
}): AlertRuleRecord {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    assetId: row.assetId,
    name: row.name,
    alertType: row.alertType,
    comparisonOperator: row.comparisonOperator,
    threshold: d(row.threshold.toString()),
    lookbackDays: row.lookbackDays,
    isActive: row.isActive,
  };
}

async function persistAlertEvent(
  triggered: TriggeredAlert,
  notificationService: NotificationService,
  rule: AlertRuleRecord
): Promise<{ id: string; alertRuleId: string; message: string }> {
  const event = await prisma.alertEvent.create({
    data: {
      alertRuleId: triggered.alertRuleId,
      currentValue: dec(triggered.currentValue),
      message: triggered.message,
    },
  });

  await notificationService.sendAlert({
    alertRuleId: rule.id,
    portfolioId: rule.portfolioId,
    alertType: rule.alertType,
    ruleName: rule.name,
    message: triggered.message,
    currentValue: triggered.currentValue,
    triggeredAt: event.triggeredAt,
  });

  return {
    id: event.id,
    alertRuleId: event.alertRuleId,
    message: event.message,
  };
}

export async function evaluateAlertRule(
  rule: AlertRuleRecord,
  context: AlertEvaluationContext,
  notificationService: NotificationService = new NoOpNotificationService()
): Promise<{ id: string; alertRuleId: string; message: string } | null> {
  if (!rule.isActive) return null;

  const evaluator = evaluatorByType.get(rule.alertType);
  if (!evaluator) return null;

  const triggered = evaluator.evaluate(rule, context);
  if (!triggered) return null;

  return persistAlertEvent(triggered, notificationService, rule);
}

export async function runAlertEngine(
  portfolioId: string,
  asOf: Date = new Date(),
  notificationService: NotificationService = new NoOpNotificationService()
): Promise<AlertEngineResult> {
  const context = await buildAlertEvaluationContext(portfolioId, asOf);
  if (!context) {
    throw new Error(`Portföy bulunamadı: ${portfolioId}`);
  }

  const rules = await prisma.alertRule.findMany({
    where: { portfolioId, isActive: true },
  });

  const events: Array<{ id: string; alertRuleId: string; message: string }> =
    [];

  for (const row of rules) {
    const rule = mapRule(row);
    const event = await evaluateAlertRule(rule, context, notificationService);
    if (event) events.push(event);
  }

  return {
    evaluated: rules.length,
    triggered: events.length,
    events,
  };
}

export async function evaluateAllPortfoliosAlerts(
  asOf: Date = startOfDay(new Date()),
  notificationService: NotificationService = new NoOpNotificationService()
): Promise<Array<{ portfolioId: string; result: AlertEngineResult }>> {
  const portfolios = await prisma.portfolio.findMany({
    select: { id: true },
  });

  const results: Array<{ portfolioId: string; result: AlertEngineResult }> = [];

  for (const portfolio of portfolios) {
    const result = await runAlertEngine(
      portfolio.id,
      asOf,
      notificationService
    );
    results.push({ portfolioId: portfolio.id, result });
  }

  return results;
}