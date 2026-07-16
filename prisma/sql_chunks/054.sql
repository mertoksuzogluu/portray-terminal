-- CreateIndex
CREATE UNIQUE INDEX "portfolio_daily_snapshots_portfolioId_snapshotDate_key" ON "portfolio_daily_snapshots"("portfolioId", "snapshotDate");

