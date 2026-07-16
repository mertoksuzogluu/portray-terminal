-- AddForeignKey
ALTER TABLE "realized_gains" ADD CONSTRAINT "realized_gains_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

