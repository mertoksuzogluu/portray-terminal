-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

