-- AddForeignKey
ALTER TABLE "portfolio_reports" ADD CONSTRAINT "portfolio_reports_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

