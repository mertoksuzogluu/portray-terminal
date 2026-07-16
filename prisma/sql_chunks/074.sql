-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

