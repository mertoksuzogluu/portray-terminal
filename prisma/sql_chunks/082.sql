-- AddForeignKey
ALTER TABLE "realized_gains" ADD CONSTRAINT "realized_gains_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

