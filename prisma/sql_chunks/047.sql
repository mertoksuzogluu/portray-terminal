-- CreateIndex
CREATE UNIQUE INDEX "asset_prices_assetId_priceDate_source_key" ON "asset_prices"("assetId", "priceDate", "source");

