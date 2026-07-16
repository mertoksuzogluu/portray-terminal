-- AddForeignKey
ALTER TABLE "benchmark_prices" ADD CONSTRAINT "benchmark_prices_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "benchmarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

