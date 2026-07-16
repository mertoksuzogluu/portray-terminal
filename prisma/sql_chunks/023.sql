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

