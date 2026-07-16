-- AddForeignKey
ALTER TABLE "position_daily_snapshots" ADD CONSTRAINT "position_daily_snapshots_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

