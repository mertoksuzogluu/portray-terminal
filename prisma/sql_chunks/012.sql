-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'TRY',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    "riskFreeRateAnnual" DECIMAL(12,8) NOT NULL DEFAULT 0.45,
    "preferredBenchmarkId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

