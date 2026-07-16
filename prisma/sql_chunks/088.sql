-- AddForeignKey
ALTER TABLE "analysis_insights" ADD CONSTRAINT "analysis_insights_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

