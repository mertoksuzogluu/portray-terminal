-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

