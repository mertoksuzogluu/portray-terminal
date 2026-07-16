-- CreateIndex
CREATE UNIQUE INDEX "benchmark_prices_benchmarkId_priceDate_source_key" ON "benchmark_prices"("benchmarkId", "priceDate", "source");

