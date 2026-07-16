-- CreateIndex
CREATE UNIQUE INDEX "position_daily_snapshots_portfolioId_assetId_snapshotDate_a_key" ON "position_daily_snapshots"("portfolioId", "assetId", "snapshotDate", "accountId");

