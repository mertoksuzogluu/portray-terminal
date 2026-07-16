-- CreateTable
CREATE TABLE "benchmarks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "benchmarkType" "BenchmarkType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "provider" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmarks_pkey" PRIMARY KEY ("id")
);

