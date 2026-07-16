-- AddForeignKey
ALTER TABLE "realized_gains" ADD CONSTRAINT "realized_gains_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

