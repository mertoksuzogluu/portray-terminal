-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'MUTUAL_FUND', 'ETF', 'CASH', 'FX', 'GOLD', 'CRYPTO', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'FUND_DISTRIBUTION', 'COMMISSION', 'TAX', 'CASH_DEPOSIT', 'CASH_WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'BONUS_ISSUE', 'RIGHTS_ISSUE', 'SPLIT', 'OTHER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BROKERAGE', 'BANK', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "BenchmarkType" AS ENUM ('INDEX', 'FX', 'COMMODITY', 'FUND', 'INFLATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('ASSET_DAILY_RETURN', 'ASSET_AVG_DAILY_RETURN', 'PORTFOLIO_DAILY_LOSS', 'PORTFOLIO_DRAWDOWN', 'ASSET_WEIGHT', 'MONTHLY_REAL_RETURN_NEGATIVE', 'ASSET_PRICE', 'DATA_STALE');

-- CreateEnum
CREATE TYPE "ComparisonOperator" AS ENUM ('GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'CROSSES_ABOVE', 'CROSSES_BELOW');

-- CreateEnum
CREATE TYPE "InsightPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "InsightCategory" AS ENUM ('PERFORMANCE', 'RISK', 'CONCENTRATION', 'INFLATION', 'BENCHMARK', 'CONTRIBUTION', 'DRAWDOWN', 'TREND', 'DATA_QUALITY');

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'POSITIVE', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "DataQuality" AS ENUM ('LIVE', 'DELAYED', 'END_OF_DAY', 'STALE', 'MANUAL', 'ERROR');

-- CreateEnum
CREATE TYPE "RealizedGainMethod" AS ENUM ('WEIGHTED_AVERAGE', 'FIFO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "riskFreeRateAnnual" DECIMAL(12,8) NOT NULL DEFAULT 0.45,
    "preferredBenchmarkId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "accountType" "AccountType" NOT NULL DEFAULT 'BROKERAGE',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "exchange" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "providerSymbol" TEXT,
    "provider" TEXT,
    "isin" TEXT,
    "tefasCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT,
    "transactionType" "TransactionType" NOT NULL,
    "transactionDate" DATE NOT NULL,
    "settlementDate" DATE,
    "quantity" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "commission" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "tax" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "fxRateToBase" DECIMAL(24,8) NOT NULL DEFAULT 1,
    "notes" TEXT,
    "importHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_prices" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "priceDate" DATE NOT NULL,
    "open" DECIMAL(24,8),
    "high" DECIMAL(24,8),
    "low" DECIMAL(24,8),
    "close" DECIMAL(24,8) NOT NULL,
    "previousClose" DECIMAL(24,8),
    "volume" DECIMAL(24,4),
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "source" TEXT NOT NULL,
    "dataQuality" "DataQuality" NOT NULL DEFAULT 'DELAYED',
    "isDelayed" BOOLEAN NOT NULL DEFAULT true,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inflation_indices" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'TR',
    "indexType" TEXT NOT NULL DEFAULT 'TUFE',
    "period" TEXT NOT NULL,
    "indexValue" DECIMAL(18,6) NOT NULL,
    "monthlyRate" DECIMAL(12,8),
    "annualRate" DECIMAL(12,8),
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inflation_indices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmarks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "benchmarkType" "BenchmarkType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "provider" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_prices" (
    "id" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "priceDate" DATE NOT NULL,
    "value" DECIMAL(24,8) NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_daily_snapshots" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "totalMarketValue" DECIMAL(24,8) NOT NULL,
    "cashValue" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "investedCapital" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "netContributions" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "dailyExternalCashFlow" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "dailyProfitLoss" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "dailyReturn" DECIMAL(18,10),
    "cumulativeProfitLoss" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "cumulativeReturn" DECIMAL(18,10),
    "twrDailyFactor" DECIMAL(18,10),
    "twrCumulative" DECIMAL(18,10),
    "inflationAdjustedCapital" DECIMAL(24,8),
    "realProfitLoss" DECIMAL(24,8),
    "realReturn" DECIMAL(18,10),
    "valueInUsd" DECIMAL(24,8),
    "valueInEur" DECIMAL(24,8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_daily_snapshots" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL DEFAULT '',
    "snapshotDate" DATE NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "averageCost" DECIMAL(24,8) NOT NULL,
    "marketPrice" DECIMAL(24,8) NOT NULL,
    "marketValue" DECIMAL(24,8) NOT NULL,
    "dailyProfitLoss" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "dailyReturn" DECIMAL(18,10),
    "unrealizedProfitLoss" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "totalReturn" DECIMAL(18,10),
    "portfolioWeight" DECIMAL(12,8),
    "contributionToDailyReturn" DECIMAL(18,10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realized_gains" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "realizedAmount" DECIMAL(24,8) NOT NULL,
    "costBasis" DECIMAL(24,8) NOT NULL,
    "proceeds" DECIMAL(24,8) NOT NULL,
    "method" "RealizedGainMethod" NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    "realizedAt" DATE NOT NULL,

    CONSTRAINT "realized_gains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "assetId" TEXT,
    "name" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "comparisonOperator" "ComparisonOperator" NOT NULL,
    "threshold" DECIMAL(24,8) NOT NULL,
    "lookbackDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentValue" DECIMAL(24,8) NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_insights" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "insightDate" DATE NOT NULL,
    "periodType" "InsightPeriodType" NOT NULL DEFAULT 'DAILY',
    "category" "InsightCategory" NOT NULL,
    "severity" "InsightSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sync_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "data_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_reports" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "portfolios_userId_idx" ON "portfolios"("userId");

-- CreateIndex
CREATE INDEX "accounts_portfolioId_idx" ON "accounts"("portfolioId");

-- CreateIndex
CREATE INDEX "assets_symbol_idx" ON "assets"("symbol");

-- CreateIndex
CREATE INDEX "assets_tefasCode_idx" ON "assets"("tefasCode");

-- CreateIndex
CREATE INDEX "assets_isActive_idx" ON "assets"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "assets_symbol_assetType_key" ON "assets"("symbol", "assetType");

-- CreateIndex
CREATE INDEX "transactions_portfolioId_transactionDate_idx" ON "transactions"("portfolioId", "transactionDate");

-- CreateIndex
CREATE INDEX "transactions_assetId_idx" ON "transactions"("assetId");

-- CreateIndex
CREATE INDEX "transactions_accountId_idx" ON "transactions"("accountId");

-- CreateIndex
CREATE INDEX "transactions_importHash_idx" ON "transactions"("importHash");

-- CreateIndex
CREATE INDEX "asset_prices_assetId_priceDate_idx" ON "asset_prices"("assetId", "priceDate");

-- CreateIndex
CREATE INDEX "asset_prices_fetchedAt_idx" ON "asset_prices"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "asset_prices_assetId_priceDate_source_key" ON "asset_prices"("assetId", "priceDate", "source");

-- CreateIndex
CREATE INDEX "inflation_indices_period_idx" ON "inflation_indices"("period");

-- CreateIndex
CREATE UNIQUE INDEX "inflation_indices_countryCode_indexType_period_key" ON "inflation_indices"("countryCode", "indexType", "period");

-- CreateIndex
CREATE UNIQUE INDEX "benchmarks_symbol_key" ON "benchmarks"("symbol");

-- CreateIndex
CREATE INDEX "benchmark_prices_benchmarkId_priceDate_idx" ON "benchmark_prices"("benchmarkId", "priceDate");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_prices_benchmarkId_priceDate_source_key" ON "benchmark_prices"("benchmarkId", "priceDate", "source");

-- CreateIndex
CREATE INDEX "portfolio_daily_snapshots_portfolioId_snapshotDate_idx" ON "portfolio_daily_snapshots"("portfolioId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_daily_snapshots_portfolioId_snapshotDate_key" ON "portfolio_daily_snapshots"("portfolioId", "snapshotDate");

-- CreateIndex
CREATE INDEX "position_daily_snapshots_portfolioId_snapshotDate_idx" ON "position_daily_snapshots"("portfolioId", "snapshotDate");

-- CreateIndex
CREATE INDEX "position_daily_snapshots_assetId_snapshotDate_idx" ON "position_daily_snapshots"("assetId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "position_daily_snapshots_portfolioId_assetId_snapshotDate_a_key" ON "position_daily_snapshots"("portfolioId", "assetId", "snapshotDate", "accountId");

-- CreateIndex
CREATE INDEX "realized_gains_portfolioId_realizedAt_idx" ON "realized_gains"("portfolioId", "realizedAt");

-- CreateIndex
CREATE INDEX "realized_gains_assetId_idx" ON "realized_gains"("assetId");

-- CreateIndex
CREATE INDEX "alert_rules_portfolioId_isActive_idx" ON "alert_rules"("portfolioId", "isActive");

-- CreateIndex
CREATE INDEX "alert_events_alertRuleId_triggeredAt_idx" ON "alert_events"("alertRuleId", "triggeredAt");

-- CreateIndex
CREATE INDEX "alert_events_isRead_idx" ON "alert_events"("isRead");

-- CreateIndex
CREATE INDEX "analysis_insights_portfolioId_insightDate_idx" ON "analysis_insights"("portfolioId", "insightDate");

-- CreateIndex
CREATE INDEX "analysis_insights_category_idx" ON "analysis_insights"("category");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_insights_portfolioId_fingerprint_insightDate_key" ON "analysis_insights"("portfolioId", "fingerprint", "insightDate");

-- CreateIndex
CREATE INDEX "data_sync_logs_provider_startedAt_idx" ON "data_sync_logs"("provider", "startedAt");

-- CreateIndex
CREATE INDEX "data_sync_logs_status_idx" ON "data_sync_logs"("status");

-- CreateIndex
CREATE INDEX "portfolio_reports_portfolioId_reportType_idx" ON "portfolio_reports"("portfolioId", "reportType");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_reports_portfolioId_reportType_periodStart_period_key" ON "portfolio_reports"("portfolioId", "reportType", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_userId_key_key" ON "app_settings"("userId", "key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_prices" ADD CONSTRAINT "asset_prices_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_prices" ADD CONSTRAINT "benchmark_prices_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "benchmarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_daily_snapshots" ADD CONSTRAINT "portfolio_daily_snapshots_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_daily_snapshots" ADD CONSTRAINT "position_daily_snapshots_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_daily_snapshots" ADD CONSTRAINT "position_daily_snapshots_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realized_gains" ADD CONSTRAINT "realized_gains_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realized_gains" ADD CONSTRAINT "realized_gains_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realized_gains" ADD CONSTRAINT "realized_gains_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_insights" ADD CONSTRAINT "analysis_insights_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_reports" ADD CONSTRAINT "portfolio_reports_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

