-- CreateIndex
CREATE UNIQUE INDEX "inflation_indices_countryCode_indexType_period_key" ON "inflation_indices"("countryCode", "indexType", "period");

