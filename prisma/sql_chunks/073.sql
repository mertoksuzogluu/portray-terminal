-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

