-- CreateTable
CREATE TABLE "inflation_indices" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'TR',
    "indexType" TEXT NOT NULL DEFAULT 'TUFE',
    "period" TEXT NOT NULL,
    "indexValue" DECIMAL(18,6) NOT NULL,
    "monthlyRate" DECIMAL(12,8),
    "annualRate" DECIMAL(12,8),
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inflation_indices_pkey" PRIMARY KEY ("id")
);

