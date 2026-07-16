-- AddForeignKey
ALTER TABLE "portfolio_daily_snapshots" ADD CONSTRAINT "portfolio_daily_snapshots_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

