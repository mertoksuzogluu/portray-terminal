-- CreateTable
CREATE TABLE "benchmark_prices" (
    "id" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "priceDate" DATE NOT NULL,
    "value" DECIMAL(24,8) NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_prices_pkey" PRIMARY KEY ("id")
);

