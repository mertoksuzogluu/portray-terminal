import type { AlertType, ComparisonOperator } from "@prisma/client";
import type { Decimal } from "@/lib/calculations/decimal";
import type { PortfolioSnapshotRecord, PositionSnapshotRecord } from "@/lib/insights/types";

export interface AlertRuleRecord {
  id: string;
  portfolioId: string;
  assetId: string | null;
  name: string;
  alertType: AlertType;
  comparisonOperator: ComparisonOperator;
  threshold: Decimal;
  lookbackDays: number | null;
  isActive: boolean;
}

export interface AlertEvaluationContext {
  portfolioId: string;
  asOf: Date;
  snapshots: PortfolioSnapshotRecord[];
  positionSnapshots: PositionSnapshotRecord[];
  assetPrices: Map<
    string,
    { price: Decimal; priceDate: Date; fetchedAt: Date; dataQuality: string }
  >;
  assetSymbols: Map<string, string>;
}

export interface TriggeredAlert {
  alertRuleId: string;
  currentValue: Decimal;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AlertEvaluator {
  readonly alertType: AlertType;
  evaluate(
    rule: AlertRuleRecord,
    context: AlertEvaluationContext
  ): TriggeredAlert | null;
}

export interface NotificationPayload {
  alertRuleId: string;
  portfolioId: string;
  alertType: AlertType;
  ruleName: string;
  message: string;
  currentValue: Decimal;
  triggeredAt: Date;
}

export interface NotificationService {
  sendAlert(payload: NotificationPayload): Promise<void>;
}

export interface AlertEngineResult {
  evaluated: number;
  triggered: number;
  events: Array<{ id: string; alertRuleId: string; message: string }>;
}

export class NoOpNotificationService implements NotificationService {
  async sendAlert(_payload: NotificationPayload): Promise<void> {
    // Gelecekte e-posta / push entegrasyonu buraya bağlanacak.
  }
}
