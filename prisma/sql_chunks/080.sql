-- AddForeignKey
ALTER TABLE "position_daily_snapshots" ADD CONSTRAINT "position_daily_snapshots_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

