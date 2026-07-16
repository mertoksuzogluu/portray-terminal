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

