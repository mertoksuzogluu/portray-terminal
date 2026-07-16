-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

